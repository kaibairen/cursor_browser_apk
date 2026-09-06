import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import {
  archiveAgent,
  cancelRun,
  createAgent,
  createRun,
  deleteAgent,
  artifactMediaKind,
  downloadArtifact,
  playbackUri,
  getAgent,
  getAgentUsage,
  getConversation,
  getRun,
  listAgents,
  listArtifacts,
  listModels,
  listRepositories,
  listRuns,
  unarchiveAgent,
} from '../../lib/cursor/client';
import { CursorApiError, isNetworkError } from '../../lib/cursor/errors';
import { isNetworkDown, networkBackoffMs } from '../../lib/cursor/reconnect';
import {
  isTerminalRun,
  type Agent,
  type AgentConversation,
  type AgentListItem,
  type ConversationMode,
  type CreateAgentRequest,
  type Paginated,
  type PromptInput,
  type Run,
} from '../../lib/cursor/types';
import { useAuth, useOptionalApiKey } from '../auth/AuthContext';
import { loadPrefs, rememberAgentModel, rememberAgentProjects, rememberRepo, savePrefs } from '../../storage/prefs';
import { mergeConversation, seedUserMessage } from './conversationView';
import { agentProjectEntry } from './projects';

function requireApiKey(apiKey: string | null): string {
  if (!apiKey) {
    throw new Error('Not signed in');
  }
  return apiKey;
}

function findListedAgent(queryClient: QueryClient, id: string): AgentListItem | undefined {
  const entries = queryClient.getQueriesData<InfiniteData<Paginated<AgentListItem>>>({ queryKey: ['agents'] });
  for (const [, data] of entries) {
    const match = data?.pages.flatMap((page) => page.items).find((item) => item.id === id);
    if (match) return match;
  }
  return undefined;
}

async function loadConversation(
  apiKey: string,
  agentId: string,
  queryClient: QueryClient,
): Promise<AgentConversation> {
  const server = await getConversation(apiKey, agentId);
  const local = queryClient.getQueryData<AgentConversation>(['conversation', agentId]);
  return {
    id: server.id,
    messages: mergeConversation(server.messages, local?.messages ?? []),
  };
}

export function useAgentList(options: { includeArchived?: boolean; enabled?: boolean } = {}) {
  const includeArchived = options.includeArchived ?? true;
  const enabled = options.enabled ?? true;
  const apiKey = useOptionalApiKey();
  const { handleApiError } = useAuth();
  return useInfiniteQuery({
    queryKey: ['agents', includeArchived],
    enabled: Boolean(apiKey) && enabled,
    queryFn: async ({ pageParam }) => {
      try {
        return await listAgents(requireApiKey(apiKey), { limit: 20, cursor: pageParam, includeArchived });
      } catch (error) {
        handleApiError(error);
        throw error;
      }
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    refetchInterval: Boolean(apiKey) && enabled ? 18_000 : false,
    refetchIntervalInBackground: false,
  });
}

export function useAgent(id: string) {
  const apiKey = useOptionalApiKey();
  const { handleApiError } = useAuth();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['agent', id],
    enabled: Boolean(apiKey && id),
    queryFn: async () => {
      try {
        const agent = await getAgent(requireApiKey(apiKey), id);
        await rememberAgentProjects({ [agent.id]: agentProjectEntry(agent) });
        return agent;
      } catch (error) {
        handleApiError(error);
        throw error;
      }
    },
    placeholderData: () => findListedAgent(queryClient, id) as Agent | undefined,
    refetchInterval: () => {
      if (isNetworkDown()) return Math.max(4_000, networkBackoffMs());
      const conversation = queryClient.getQueryData<AgentConversation>(['conversation', id]);
      const last = conversation?.messages[conversation.messages.length - 1];
      if (last && /user/i.test(last.type)) return 2_000;
      return 12_000;
    },
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function useRun(agentId: string, runId: string | undefined, live: boolean) {
  const apiKey = useOptionalApiKey();
  const { handleApiError } = useAuth();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['run', agentId, runId],
    enabled: Boolean(apiKey && runId),
    queryFn: async () => {
      try {
        const run = await getRun(requireApiKey(apiKey), agentId, runId!);
        const previous = queryClient.getQueryData<Run>(['run', agentId, runId]);
        if (isTerminalRun(run.status) && (!previous || !isTerminalRun(previous.status))) {
          void queryClient.invalidateQueries({ queryKey: ['conversation', agentId] });
        }
        return run;
      } catch (error) {
        handleApiError(error);
        throw error;
      }
    },
    refetchInterval: (query) => {
      if (isNetworkDown()) return Math.max(4_000, networkBackoffMs());
      if (!live) return false;
      const status = query.state.data?.status;
      if (status && isTerminalRun(status)) return false;
      if (status === 'CREATING') return 700;
      return 4_000;
    },
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function useConversation(agentId: string, live: boolean) {
  const apiKey = useOptionalApiKey();
  const { handleApiError } = useAuth();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['conversation', agentId],
    enabled: Boolean(apiKey && agentId),
    queryFn: async () => {
      try {
        return await loadConversation(requireApiKey(apiKey), agentId, queryClient);
      } catch (error) {
        handleApiError(error);
        const local = queryClient.getQueryData<AgentConversation>(['conversation', agentId]);
        if (local?.messages.length && isNetworkError(error)) {
          return local;
        }
        throw error;
      }
    },
    placeholderData: (previous) => previous,
    refetchInterval: (query) => {
      if (isNetworkDown()) return Math.max(4_000, networkBackoffMs());
      if (live) return 2_000;
      const messages = query.state.data?.messages ?? [];
      const last = messages[messages.length - 1];
      if (last && /user/i.test(last.type)) return 2_000;
      return 12_000;
    },
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function usePrefetchAgentDetail() {
  const apiKey = useOptionalApiKey();
  const queryClient = useQueryClient();
  const { handleApiError } = useAuth();
  return (id: string) => {
    if (!apiKey || !id) return;
    void queryClient.prefetchQuery({
      queryKey: ['agent', id],
      queryFn: async () => {
        const agent = await getAgent(requireApiKey(apiKey), id);
        await rememberAgentProjects({ [agent.id]: agentProjectEntry(agent) });
        return agent;
      },
    });
    void queryClient.prefetchQuery({
      queryKey: ['conversation', id],
      queryFn: async () => {
        try {
          return await loadConversation(requireApiKey(apiKey), id, queryClient);
        } catch (error) {
          handleApiError(error);
          throw error;
        }
      },
    });
  };
}

export function useRuns(agentId: string) {
  const apiKey = useOptionalApiKey();
  const { handleApiError } = useAuth();
  return useQuery({
    queryKey: ['runs', agentId],
    enabled: Boolean(apiKey && agentId),
    queryFn: async () => {
      try {
        return await listRuns(requireApiKey(apiKey), agentId, { limit: 20 });
      } catch (error) {
        handleApiError(error);
        throw error;
      }
    },
  });
}

export function useModels() {
  const apiKey = useOptionalApiKey();
  const { handleApiError } = useAuth();
  return useQuery({
    queryKey: ['models'],
    enabled: Boolean(apiKey),
    queryFn: async () => {
      try {
        return await listModels(requireApiKey(apiKey));
      } catch (error) {
        handleApiError(error);
        throw error;
      }
    },
    staleTime: 24 * 60 * 60 * 1000,
  });
}

export function useRepositories() {
  const apiKey = useOptionalApiKey();
  const { handleApiError } = useAuth();
  return useQuery({
    queryKey: ['repositories'],
    enabled: Boolean(apiKey),
    queryFn: async () => {
      const prefs = await loadPrefs();
      const age = prefs.lastRepoRefreshAt ? Date.now() - prefs.lastRepoRefreshAt : Number.POSITIVE_INFINITY;
      if (prefs.cachedRepos && prefs.cachedRepos.length > 0 && age < 60_000) {
        return { items: prefs.cachedRepos };
      }
      try {
        const result = await listRepositories(requireApiKey(apiKey));
        await savePrefs({
          ...prefs,
          cachedRepos: result.items,
          lastRepoRefreshAt: Date.now(),
        });
        return result;
      } catch (error) {
        handleApiError(error);
        if (prefs.cachedRepos && prefs.cachedRepos.length > 0) {
          return { items: prefs.cachedRepos };
        }
        throw error;
      }
    },
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
}

export function useUsage(agentId: string) {
  const apiKey = useOptionalApiKey();
  const { handleApiError } = useAuth();
  return useQuery({
    queryKey: ['usage', agentId],
    enabled: Boolean(apiKey && agentId),
    queryFn: async () => {
      try {
        return await getAgentUsage(requireApiKey(apiKey), agentId);
      } catch (error) {
        handleApiError(error);
        throw error;
      }
    },
  });
}

export function useArtifacts(agentId: string, options: { live?: boolean } = {}) {
  const apiKey = useOptionalApiKey();
  const { handleApiError } = useAuth();
  return useQuery({
    queryKey: ['artifacts', agentId],
    enabled: Boolean(apiKey && agentId),
    refetchInterval: options.live ? 8_000 : 12_000,
    queryFn: async () => {
      try {
        return await listArtifacts(requireApiKey(apiKey), agentId);
      } catch (error) {
        handleApiError(error);
        throw error;
      }
    },
  });
}

export function useArtifactMedia(agentId: string, path: string) {
  const apiKey = useOptionalApiKey();
  const { handleApiError } = useAuth();
  const kind = artifactMediaKind(path);
  return useQuery({
    queryKey: ['artifact-media', agentId, path],
    enabled: Boolean(apiKey && agentId && path && kind),
    staleTime: 8 * 60 * 1000,
    refetchInterval: 8 * 60 * 1000,
    queryFn: async () => {
      if (!kind) {
        throw new Error('不是可预览的媒体');
      }
      try {
        const file = await downloadArtifact(requireApiKey(apiKey), agentId, path);
        return {
          uri: playbackUri(kind, file.url),
          kind,
          expiresAt: file.expiresAt,
        };
      } catch (error) {
        handleApiError(error);
        throw error;
      }
    },
  });
}

export function useCreateAgent() {
  const apiKey = useOptionalApiKey();
  const queryClient = useQueryClient();
  const { handleApiError } = useAuth();
  return useMutation({
    mutationFn: async (body: Omit<CreateAgentRequest, 'agentId'>) => {
      const key = requireApiKey(apiKey);
      const agentId = `bc-${Crypto.randomUUID()}`;
      try {
        const result = await createAgent(key, { ...body, agentId });
        await rememberAgentProjects({
          [result.agent.id]: agentProjectEntry(result.agent, { modelId: body.model?.id }),
        });
        if (body.repos?.[0]?.url) {
          await rememberRepo(body.repos[0].url);
        }
        if (body.model?.id) {
          await rememberAgentModel(result.agent.id, body.model.id);
        }
        if (body.env?.name || body.model?.id) {
          const prefs = await loadPrefs();
          await savePrefs({
            ...prefs,
            defaultEnvName: body.env?.name ?? prefs.defaultEnvName,
            defaultModelId: body.model?.id ?? prefs.defaultModelId,
            defaultModelParams: body.model?.params ?? prefs.defaultModelParams,
          });
        }
        return result;
      } catch (error) {
        handleApiError(error);
        throw error;
      }
    },
    onSuccess: (result, body) => {
      queryClient.setQueryData(['agent', result.agent.id], {
        ...result.agent,
        status: result.agent.status ?? 'ACTIVE',
        latestRunId: result.run.id,
      });
      queryClient.setQueryData(['run', result.agent.id, result.run.id], result.run);
      void queryClient.invalidateQueries({ queryKey: ['agents'] });
      const text = body.prompt?.text?.trim();
      if (text) {
        queryClient.setQueryData<AgentConversation>(['conversation', result.agent.id], (current) =>
          seedUserMessage(current, result.agent.id, text),
        );
      }
    },
  });
}

export function useCreateFollowUp(agentId: string) {
  const apiKey = useOptionalApiKey();
  const queryClient = useQueryClient();
  const { handleApiError } = useAuth();
  return useMutation({
    mutationFn: async (input: { prompt: PromptInput; mode?: ConversationMode; model?: { id: string } }) => {
      try {
        return await createRun(requireApiKey(apiKey), agentId, input.prompt, {
          mode: input.mode,
          model: input.model,
        });
      } catch (error) {
        handleApiError(error);
        throw error;
      }
    },
    onMutate: async (input) => {
      const key = ['conversation', agentId] as const;
      const previous = queryClient.getQueryData<AgentConversation>(key);
      await queryClient.cancelQueries({ queryKey: key });
      const retained = queryClient.getQueryData<AgentConversation>(key) ?? previous;
      queryClient.setQueryData<AgentConversation>(key, seedUserMessage(retained, agentId, input.prompt.text));
      return { previous: retained };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['conversation', agentId], context.previous);
      }
    },
    onSuccess: (result, input) => {
      queryClient.setQueryData(['run', agentId, result.run.id], result.run);
      queryClient.setQueryData(['agent', agentId], (current: Agent | undefined) =>
        current ? { ...current, status: 'ACTIVE', latestRunId: result.run.id } : current,
      );
      if (input.model?.id) {
        void rememberAgentModel(agentId, input.model.id);
      }
      void queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
      void queryClient.invalidateQueries({ queryKey: ['runs', agentId] });
      void queryClient.invalidateQueries({ queryKey: ['run', agentId] });
      void queryClient.invalidateQueries({ queryKey: ['usage', agentId] });
    },
  });
}

export function useCancelRun(agentId: string) {
  const apiKey = useOptionalApiKey();
  const queryClient = useQueryClient();
  const { handleApiError } = useAuth();
  return useMutation({
    mutationFn: async (runId: string) => {
      try {
        return await cancelRun(requireApiKey(apiKey), agentId, runId);
      } catch (error) {
        handleApiError(error);
        throw error;
      }
    },
    onSuccess: (_result, runId) => {
      queryClient.setQueryData(['run', agentId, runId], (current: { status?: string } | undefined) =>
        current ? { ...current, status: 'CANCELLED' } : current,
      );
      queryClient.setQueryData(['agent', agentId], (current: Agent | undefined) =>
        current ? { ...current, status: 'IDLE' } : current,
      );
      void queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
      void queryClient.invalidateQueries({ queryKey: ['runs', agentId] });
      void queryClient.invalidateQueries({ queryKey: ['run', agentId, runId] });
    },
  });
}

export function useArchiveAgent(agentId: string) {
  const apiKey = useOptionalApiKey();
  const queryClient = useQueryClient();
  const { handleApiError } = useAuth();
  return useMutation({
    mutationFn: async (archived: boolean) => {
      const key = requireApiKey(apiKey);
      try {
        return archived ? await unarchiveAgent(key, agentId) : await archiveAgent(key, agentId);
      } catch (error) {
        handleApiError(error);
        throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
      void queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });
}

export function useDeleteAgent() {
  const apiKey = useOptionalApiKey();
  const queryClient = useQueryClient();
  const { handleApiError } = useAuth();
  return useMutation({
    mutationFn: async (agentId: string) => {
      try {
        return await deleteAgent(requireApiKey(apiKey), agentId);
      } catch (error) {
        handleApiError(error);
        throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });
}

export function useDownloadArtifact(agentId: string) {
  const apiKey = useOptionalApiKey();
  const { handleApiError } = useAuth();
  return useMutation({
    mutationFn: async (path: string) => {
      try {
        return await downloadArtifact(requireApiKey(apiKey), agentId, path);
      } catch (error) {
        handleApiError(error);
        throw error;
      }
    },
  });
}

export function isBusyError(error: unknown): boolean {
  return error instanceof CursorApiError && error.code === 'agent_busy';
}
