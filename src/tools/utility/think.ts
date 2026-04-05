import { registerTool } from '../registry.js';
import type { AgentConfig } from '../../types/index.js';

registerTool({
  definition: {
    name: 'think',
    description:
      'Record your reasoning, analysis, or plan without taking action. Use this to: break down complex problems, plan multi-step solutions, verify logic, or reason through tradeoffs. The thinking is visible to the user.',
    category: 'utility',
    dangerLevel: 'safe',
    emoji: '💭',
    parameters: {
      type: 'object',
      properties: {
        thought: {
          type: 'string',
          description: 'Your reasoning, analysis, or plan',
        },
      },
      required: ['thought'],
    },
  },
  handler: async (args: Record<string, unknown>, _config: AgentConfig) => {
    const thought = String(args.thought).trim();
    // Return cleanly so the renderer can display it as a thought block
    return thought;
  },
});
