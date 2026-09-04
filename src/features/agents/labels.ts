import type { AgentStatus, RunStatus } from '../../lib/cursor/types';

export function agentStatusLabel(status: AgentStatus): string {
  switch (status) {
    case 'ACTIVE':
      return '进行中';
    case 'IDLE':
      return '空闲';
    case 'ARCHIVED':
      return '已归档';
    default:
      return status;
  }
}

export function agentStatusTone(status: AgentStatus): 'active' | 'idle' | 'error' | 'done' {
  switch (status) {
    case 'ACTIVE':
      return 'active';
    case 'IDLE':
      return 'done';
    case 'ARCHIVED':
      return 'idle';
    default:
      return 'idle';
  }
}

export function runStatusLabel(status: RunStatus): string {
  switch (status) {
    case 'CREATING':
      return '创建中';
    case 'RUNNING':
      return '运行中';
    case 'FINISHED':
      return '已完成';
    case 'ERROR':
      return '出错';
    case 'CANCELLED':
      return '已取消';
    case 'EXPIRED':
      return '已过期';
    default:
      return status;
  }
}

export function runStatusTone(status: RunStatus): 'active' | 'idle' | 'error' | 'done' {
  switch (status) {
    case 'CREATING':
    case 'RUNNING':
      return 'active';
    case 'FINISHED':
      return 'done';
    case 'ERROR':
    case 'EXPIRED':
      return 'error';
    case 'CANCELLED':
      return 'idle';
    default:
      return 'idle';
  }
}
