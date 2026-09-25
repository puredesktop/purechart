import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type { AgentToolHandlerResult } from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import { suggestForms } from '../../../lib/chartForms'
import type { ChartAgentToolContext } from '../../context'

/** The forms this table supports, best first, each with the job it does. */
export async function suggestChartFormsHandler(
  context: ChartAgentToolContext,
): Promise<AgentToolHandlerResult> {
  const forms = suggestForms(context.table)
  return {
    content: formatAgentToolJson({
      forms: forms.map((form, index) => ({
        index,
        type: form.type,
        job: form.job,
        because: form.because,
        supported: form.supported,
        encodings: form.encodings,
        facet: form.facet,
      })),
      note: 'Apply one with chooseChartForm, by its index.',
    }),
  }
}
