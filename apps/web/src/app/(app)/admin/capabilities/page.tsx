import { requireAdmin } from '@/lib/session';
import { Card, SectionHeading, StatusBadge } from '@mios/ui';
import { capabilities } from '@mios/config';
import { generationMode } from '@mios/ai';
import { UNIMPLEMENTED_CONNECTOR_TYPES, listConnectors } from '@mios/connectors';

export const dynamic = 'force-dynamic';

/** Honest capability reporting: what runs, what falls back, what is not built. */
export default async function CapabilitiesPage() {
  await requireAdmin();
  const caps = capabilities();
  const mode = generationMode();
  const connectors = listConnectors();

  return (
    <div className="mx-auto max-w-[900px] space-y-6">
      <header>
        <h1 className="text-[24px] font-semibold tracking-tight">Capabilities</h1>
        <p className="mt-1 max-w-[70ch] text-[14px] leading-relaxed text-[var(--text-muted)]">
          What this deployment can actually do right now. Anything not configured is reported as not
          configured rather than quietly simulated.
        </p>
      </header>

      <Card>
        <SectionHeading>Generation mode</SectionHeading>
        <p className="text-[14px] font-medium">{mode.label}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-muted)]">{mode.detail}</p>
      </Card>

      <Card>
        <SectionHeading>Integrations</SectionHeading>
        <ul className="space-y-3">
          {caps.map((cap) => (
            <li key={cap.key}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-medium">{cap.label}</span>
                <StatusBadge status={cap.status} />
              </div>
              <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--text-subtle)]">{cap.detail}</p>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <SectionHeading>Implemented connectors</SectionHeading>
        <ul className="space-y-2">
          {connectors.map((connector) => (
            <li key={connector.type}>
              <p className="text-[13px] font-medium">{connector.label}</p>
              <p className="text-[12px] leading-relaxed text-[var(--text-subtle)]">{connector.description}</p>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <SectionHeading hint="Interfaces exist; the implementations do not.">
          Not implemented
        </SectionHeading>
        <ul className="space-y-1.5">
          {UNIMPLEMENTED_CONNECTOR_TYPES.map((item) => (
            <li key={item.type} className="text-[13px]">
              <span className="font-medium">{item.type}</span>
              <span className="text-[var(--text-muted)]"> — {item.reason}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
