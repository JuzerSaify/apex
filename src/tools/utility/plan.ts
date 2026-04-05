import { registerTool } from '../registry.js';
import type { AgentConfig } from '../../types/index.js';

/**
 * plan — structured multi-step planning tool.
 * Renders a visible plan to the user and returns execution guidance.
 * Separate from think: plan is ACTION-oriented with checkable steps.
 */
registerTool({
  definition: {
    name: 'plan',
    description:
      'Create a structured execution plan with numbered steps, goal, and success criteria. Renders visually to the user. Use this at the START of complex multi-step tasks to show your approach. After calling plan, execute the steps immediately without recapping.',
    category: 'utility',
    dangerLevel: 'safe',
    emoji: '📌',
    parameters: {
      type: 'object',
      properties: {
        goal: {
          type: 'string',
          description: 'One-sentence description of what you are trying to accomplish',
        },
        steps: {
          type: 'array',
          description: 'Numbered execution steps in order',
          items: { type: 'string' },
        },
        success_criteria: {
          type: 'string',
          description: 'What "done" looks like — how you will verify the task is complete',
        },
        risks: {
          type: 'string',
          description: 'The most likely failure point and your mitigation (optional)',
        },
      },
      required: ['goal', 'steps'],
    },
  },
  handler: async (args: Record<string, unknown>, _config: AgentConfig) => {
    const goal = String(args.goal);
    const steps = (args.steps as string[]).map((s, i) => `  ${i + 1}. ${s}`).join('\n');
    const success = args.success_criteria ? `\nDone when: ${String(args.success_criteria)}` : '';
    const risks = args.risks ? `\nRisk: ${String(args.risks)}` : '';

    return `PLAN: ${goal}\n${steps}${success}${risks}`;
  },
});
