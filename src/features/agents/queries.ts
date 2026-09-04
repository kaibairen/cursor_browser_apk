import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import {
  archiveAgent,
  cancelRun,
  createAgent,
  createRun,
  deleteAgent,
  downloadArtifact,
  getAgent,
  getAgentUsage,
  getRun,
  listAgents,
  listArtifacts,
  listModels,
  listRepositories,
  listRuns,
  unarchiveAgent,
} from '../../lib/cursor/client';
import { CursorApiError } from '../../lib/cursor/errors';
import { isTerminalRun, type ConversationMode, type CreateAgentRequest, type PromptInput } from '../../lib/cursor/types';
import { useApiKey, useAuth } from '../auth/AuthContext';
import { loadPrefs, rememberRepo, savePrefs } from '../../storage/prefs';

export function useAgentList(options: { includeArchived?: boolean; enabled?: boolean } = {}) {
  const includeArchived = options.includeArchived ?? true;
  const enabled = options.enabled ?? true;
  const apiKey = useApiKey();
  const { handleApiError } = useAuth();
  return useInfiniteQuery({
    queryKey: ['agents', includeArchived],
    enabled,
    queryFn: async ({ pageParam }) => {
      try {
        return await listAgents(apiKey, { limit: 20, cursor: pageParam, includeArchived });
      } catch (error) {
        handleApiError(error);
        throw error;
      }
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    refetchInterval: enabled ? 18_000 : false,
    refetchIntervalInBackground: false,
  });
}

export function useAgent(id: string) {
  const apiKey = useApiKey();
  const { handleApiError } = useAuth();
  return useQuery({
    queryKey: ['agent', id],
    queryFn: async () => {
      try {
        return await getAgent(apiKey, id);
      } catch (error) {
        handleApiError(error);
        throw error;
      }
    },
    refetchInterval: 12_000,
    refetchIntervalInBackground: false,
  });
}

export function useRun(agentId: string, runId: string | undefined, live: boolean) {
  const apiKey = useApiKey();
  const { handleApiError } = useAuth();
  return useQuery({
    queryKey: ['run', agentId, runId],
    enabled: Boolean(runId),
    queryFn: async () => {
      try {
        return await getRun(apiKey, agentId, runId!);
      } catch (error) {
        handleApiError(error);
        throw error;
      }
    },
    refetchInterval: (query) => {
      if (!live) return false;
      const status = query.state.data?.status;
      if (status && isTerminalRun(status)) return false;
      return 4_000;
    },
    refetchIntervalInBackground: false,
  });
}

export function useRuns(agentId: string) {
  const apiKey = useApiKey();
  const { handleApiError } = useAuth();
  return useQuery({
    queryKey: ['runs', agentId],
    queryFn: async () => {
      try {
        return await listRuns(apiKey, agentId, { limit: 20 });
      } catch (error) {
        handleApiError(error);
        throw error;
      }
    },
  });
}

export function useModels() {
  const apiKey = useApiKey();
  const { handleApiError } = useAuth();
  return useQuery({
    queryKey: ['models'],
    queryFn: async () => {
      try {
        return await listModels(apiKey);
      } catch (error) {
        handleApiError(error);
        throw error;
      }
    },
    staleTime: 24 * 60 * 60 * 1000,
  });
}

export function useRepositories() {
  const apiKey = useApiKey();
  const { handleApiError } = useAuth();
  return useQuery({
    queryKey: ['repositories'],
    queryFn: async () => {
      const prefs = await loadPrefs();
      const age = prefs.lastRepoRefreshAt ? Date.now() - prefs.lastRepoRefreshAt : Number.POSITIVE_INFINITY;
      if (prefs.cachedRepos && prefs.cachedRepos.length > 0 && age < 60_000) {
        return { items: prefs.cachedRepos };
      }
      try {
        const result = await listRepositories(apiKey);
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
  const apiKey = useApiKey();
  const { handleApiError } = useAuth();
  return useQuery({
    queryKey: ['usage', agentId],
    queryFn: async () => {
      try {
        return await getAgentUsage(apiKey, agentId);
      } catch (error) {
        handleApiError(error);
        throw error;
      }
    },
  });
}

export function useArtifacts(agentId: string) {
  const apiKey = useApiKey();
  const { handleApiError } = useAuth();
  return useQuery({
    queryKey: ['artifacts', agentId],
    queryFn: async () => {
      try {
        return await listArtifacts(apiKey, agentId);
      } catch (error) {
        handleApiError(error);
        throw error;
      }
    },
  });
}

export function useCreateAgent() {
  const apiKey = useApiKey();
  const queryClient = useQueryClient();
  const { handleApiError } = useAuth();
  return useMutation({
    mutationFn: async (body: Omit<CreateAgentRequest, 'agentId'>) => {
      const agentId = `bc-${Crypto.randomUUID()}`;
      try {
        const result = await createAgent(apiKey, { ...body, agentId });
        if (body.repos?.[0]?.url) {
          await rememberRepo(body.repos[0].url);
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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });
}

export function useCreateFollowUp(agentId: string) {
  const apiKey = useApiKey();
  const queryClient = useQueryClient();
  const { handleApiError } = useAuth();
  return useMutation({
    mutationFn: async (input: { prompt: PromptInput; mode?: ConversationMode }) => {
      try {
        return await createRun(apiKey, agentId, input.prompt, input.mode);
      } catch (error) {
        handleApiError(error);
        throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
      void queryClient.invalidateQueries({ queryKey: ['runs', agentId] });
      void queryClient.invalidateQueries({ queryKey: ['run', agentId] });
      void queryClient.invalidateQueries({ queryKey: ['usage', agentId] });
    },
  });
}

export function useCancelRun(agentId: string) {
  const apiKey = useApiKey();
  const queryClient = useQueryClient();
  const { handleApiError } = useAuth();
  return useMutation({
    mutationFn: async (runId: string) => {
      try {
        return await cancelRun(apiKey, agentId, runId);
      } catch (error) {
        handleApiError(error);
        throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
      void queryClient.invalidateQueries({ queryKey: ['runs', agentId] });
    },
  });
}

export function useArchiveAgent(agentId: string) {
  const apiKey = useApiKey();
  const queryClient = useQueryClient();
  const { handleApiError } = useAuth();
  return useMutation({
    mutationFn: async (archived: boolean) => {
      try {
        return archived ? await unarchiveAgent(apiKey, agentId) : await archiveAgent(apiKey, agentId);
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
  const apiKey = useApiKey();
  const queryClient = useQueryClient();
  const { handleApiError } = useAuth();
  return useMutation({
    mutationFn: async (agentId: string) => {
      try {
        return await deleteAgent(apiKey, agentId);
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
  const apiKey = useApiKey();
  const { handleApiError } = useAuth();
  return useMutation({
    mutationFn: async (path: string) => {
      try {
        return await downloadArtifact(apiKey, agentId, path);
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
