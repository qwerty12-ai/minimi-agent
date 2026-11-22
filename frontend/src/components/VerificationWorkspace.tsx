import { useEffect, useMemo, useState } from 'react'
import {
  getResearchSnapshots,
  verifyResearch,
  type ResearchSnapshotSummary,
  type VerificationResponse,
} from '../lib/api'

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function statusClasses(status: string): string {
  switch (status) {
    case 'unchanged':
      return 'bg-[var(--status-green)]/10 text-[var(--status-green)]'
    case 'changed':
      return 'bg-[var(--status-red)]/10 text-[var(--status-red)]'
    case 'unsupported':
    case 'historical_only':
      return 'bg-[var(--status-yellow)]/10 text-[var(--status-yellow)]'
    case 'current_only':
      return 'bg-[var(--accent)]/10 text-[var(--accent)]'
    default:
      return 'bg-[var(--surface-hover)] text-[var(--text-secondary)]'
  }
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex px-2 py-1 text-xs font-medium capitalize ${statusClasses(status)}`}
    >
      {status.replaceAll('_', ' ')}
    </span>
  )
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4 sm:p-5">
      <div>
        <h2 className="text-base font-semibold text-[var(--text-primary)]">
          {title}
        </h2>

        {description && (
          <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
            {description}
          </p>
        )}
      </div>

      <div className="mt-5">{children}</div>
    </section>
  )
}

function VerificationWorkspace() {
  const [snapshots, setSnapshots] = useState<ResearchSnapshotSummary[]>([])
  const [selectedSnapshotId, setSelectedSnapshotId] = useState('')
  const [question, setQuestion] = useState('')

  const [loadingSnapshots, setLoadingSnapshots] = useState(true)
  const [verifying, setVerifying] = useState(false)

  const [snapshotError, setSnapshotError] = useState<string | null>(null)
  const [verificationError, setVerificationError] = useState<string | null>(null)

  const [result, setResult] = useState<VerificationResponse | null>(null)

  async function loadSnapshots() {
    setLoadingSnapshots(true)
    setSnapshotError(null)

    try {
      const response = await getResearchSnapshots(100)

      setSnapshots(response.snapshots)

      setSelectedSnapshotId((current) => {
        if (
          current &&
          response.snapshots.some((snapshot) => snapshot.id === current)
        ) {
          return current
        }

        return response.snapshots[0]?.id ?? ''
      })
    } catch (error) {
      setSnapshotError(
        error instanceof Error
          ? error.message
          : 'Failed to load historical research snapshots.',
      )
    } finally {
      setLoadingSnapshots(false)
    }
  }

  useEffect(() => {
    void loadSnapshots()
  }, [])

  async function handleVerify() {
    if (!selectedSnapshotId) return

    setVerifying(true)
    setVerificationError(null)
    setResult(null)

    const selectedSnapshot = snapshots.find(
      (snapshot) => snapshot.id === selectedSnapshotId,
    )

    try {
      const response = await verifyResearch({
        historicalSnapshotId: selectedSnapshotId,
        ...(selectedSnapshot?.conversationId
          ? { conversationId: selectedSnapshot.conversationId }
          : {}),
        ...(question.trim() ? { question: question.trim() } : {}),
      })

      setResult(response)
    } catch (error) {
      setVerificationError(
        error instanceof Error ? error.message : 'Verification failed.',
      )
    } finally {
      setVerifying(false)
    }
  }

  const selectedSnapshot = snapshots.find(
    (snapshot) => snapshot.id === selectedSnapshotId,
  )

  const groupedFindings = useMemo(() => {
    if (!result) return []

    const groups = new Map<string, typeof result.verification.findings>()

    for (const finding of result.verification.findings) {
      const key = finding.claim.trim().toLowerCase()
      const existing = groups.get(key) ?? []

      existing.push(finding)
      groups.set(key, existing)
    }

    return Array.from(groups.values())
  }, [result])

  const comparisonCounts = useMemo(() => {
    if (!result) return {}

    return result.comparisons.reduce<Record<string, number>>(
      (counts, comparison) => {
        counts[comparison.status] = (counts[comparison.status] ?? 0) + 1
        return counts
      },
      {},
    )
  }, [result])

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 overflow-y-auto space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <header className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--accent)]">
          Research integrity
        </p>

        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          Verification
        </h1>

        <p className="max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
          Revisit historical research and compare it against fresh evidence
          to identify what has changed, what remains consistent, and what
          can no longer be supported.
        </p>
      </header>

      <section className="border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4 sm:p-5">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              Verify historical research
            </h2>

            <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
              Select a previously recorded research snapshot.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadSnapshots()}
            disabled={loadingSnapshots}
            className="border border-[var(--border-strong)] px-3 py-2 text-sm text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingSnapshots ? 'Refreshing...' : 'Refresh snapshots'}
          </button>
        </div>

        {loadingSnapshots && snapshots.length === 0 && (
          <div className="border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6 text-center text-sm text-[var(--text-secondary)]">
            Loading historical research...
          </div>
        )}

        {snapshotError && (
          <div className="border border-[var(--status-red)]/40 bg-[var(--surface-raised)] p-4 text-sm text-[var(--status-red)]">
            <p className="font-medium">Could not load snapshots</p>
            <p className="mt-1">{snapshotError}</p>
          </div>
        )}

        {!loadingSnapshots && !snapshotError && snapshots.length === 0 && (
          <div className="border border-dashed border-[var(--border-strong)] p-8 text-center">
            <h3 className="font-medium text-[var(--text-primary)]">
              No historical research available
            </h3>

            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              Run a research query in the Research workspace first.
              MiniMi will save a snapshot that you can verify here.
            </p>
          </div>
        )}

        {snapshots.length > 0 && (
          <div className="space-y-5">
            <div>
              <label
                htmlFor="snapshot-select"
                className="mb-2 block text-sm font-medium text-[var(--text-primary)]"
              >
                Historical snapshot
              </label>

              <select
                id="snapshot-select"
                value={selectedSnapshotId}
                onChange={(event) => {
                  setSelectedSnapshotId(event.target.value)
                  setResult(null)
                  setVerificationError(null)
                }}
                disabled={loadingSnapshots || verifying}
                className="w-full border border-[var(--border-strong)] bg-[var(--surface-input)] px-3 py-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--accent-muted)]"
              >
                {snapshots.map((snapshot) => (
                  <option key={snapshot.id} value={snapshot.id}>
                    {snapshot.query} — {formatDate(snapshot.recordedAt)}
                  </option>
                ))}
              </select>
            </div>

            {selectedSnapshot && (
              <div className="border border-[var(--border-subtle)] bg-[var(--surface-base)] p-4">
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
                      Original query
                    </p>

                    <p className="mt-1 text-sm font-medium text-[var(--text-primary)]">
                      {selectedSnapshot.query}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
                        Provider
                      </p>

                      <p className="mt-1 text-sm text-[var(--text-primary)]">
                        {selectedSnapshot.provider}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
                        Originally searched
                      </p>

                      <p className="mt-1 text-sm text-[var(--text-primary)]">
                        {formatDate(selectedSnapshot.searchedAt)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor="verification-question"
                className="mb-2 block text-sm font-medium text-[var(--text-primary)]"
              >
                Specific claim or question (optional)
              </label>

              <textarea
                id="verification-question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="What specifically do you want MiniMi to recheck? Leave blank to verify the original query."
                rows={4}
                disabled={verifying}
                className="w-full resize-y border border-[var(--border-strong)] bg-[var(--surface-input)] px-3 py-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--accent-muted)] disabled:opacity-50"
              />

              <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                When provided, this question is used to focus verification
                against the selected historical research.
              </p>
            </div>

            {verificationError && (
              <div className="border border-[var(--status-red)]/40 bg-[var(--surface-raised)] p-4 text-sm text-[var(--status-red)]">
                <p className="font-medium">Verification failed</p>
                <p className="mt-1">{verificationError}</p>
              </div>
            )}

            <button
              type="button"
              onClick={() => void handleVerify()}
              disabled={!selectedSnapshotId || verifying || loadingSnapshots}
              className="inline-flex w-full items-center justify-center border border-[var(--border-strong)] bg-[var(--surface-raised)] px-5 py-3 text-sm font-medium text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {verifying
                ? 'Verifying against fresh research...'
                : 'Verify selected research'}
            </button>

            {verifying && (
              <p className="text-sm leading-6 text-[var(--text-secondary)]">
                MiniMi is retrieving fresh evidence and comparing it with
                the historical snapshot. This may take a while.
              </p>
            )}
          </div>
        )}
      </section>

      {result && (
        <section className="space-y-6">
          <SectionCard title="Verification summary">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Overall result
                </p>

                <div className="mt-2">
                  <StatusBadge status={result.verification.status} />
                </div>
              </div>

              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Verified at
                </p>

                <p className="mt-2 text-sm text-[var(--text-primary)]">
                  {formatDate(result.verification.verifiedAt)}
                </p>
              </div>
            </div>

            <div className="mt-5 border border-[var(--border-subtle)] bg-[var(--surface-base)] p-4">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
                Verified query
              </p>

              <p className="mt-2 text-sm leading-6 text-[var(--text-primary)]">
                {result.verification.query}
              </p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="border border-[var(--border-subtle)] p-4">
                <p className="text-xs text-[var(--text-muted)]">Findings</p>

                <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
                  {result.verification.findings.length}
                </p>
              </div>

              <div className="border border-[var(--border-subtle)] p-4">
                <p className="text-xs text-[var(--text-muted)]">
                  Unique claims
                </p>

                <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
                  {groupedFindings.length}
                </p>
              </div>

              <div className="border border-[var(--border-subtle)] p-4">
                <p className="text-xs text-[var(--text-muted)]">
                  Comparisons
                </p>

                <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
                  {result.comparisons.length}
                </p>
              </div>

              <div className="border border-[var(--border-subtle)] p-4">
                <p className="text-xs text-[var(--text-muted)]">
                  Evidence records
                </p>

                <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
                  {result.comparisons.reduce(
                    (total, comparison) =>
                      total +
                      comparison.historicalEvidenceIds.length +
                      comparison.currentEvidenceIds.length,
                    0,
                  )}
                </p>
              </div>
            </div>

            <div className="mt-5">
              <p className="text-sm font-medium text-[var(--text-primary)]">
                Comparison status breakdown
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(comparisonCounts).map(([status, count]) => (
                  <div
                    key={status}
                    className="flex items-center gap-2 border border-[var(--border-subtle)] px-3 py-2"
                  >
                    <StatusBadge status={status} />

                    <span className="text-sm font-semibold text-[var(--text-primary)]">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 border border-[var(--border-subtle)] bg-[var(--surface-base)] p-4 text-sm leading-6 text-[var(--text-secondary)]">
              <p className="font-semibold text-[var(--text-primary)]">
                How to interpret this result
              </p>

              <p className="mt-2">
                Evidence comparisons describe the relationship between
                retrieved sources. A source disappearing, a new source
                appearing, or content changing does not automatically mean
                the underlying factual claim has changed. An inconclusive
                result means the available evidence was not sufficient to
                confidently establish a verification outcome.
              </p>
            </div>
          </SectionCard>

          <SectionCard
            title="Findings"
            description="Repeated claims are grouped together to reduce noise. Expand a claim to inspect its individual findings."
          >
            {groupedFindings.length === 0 ? (
              <div className="border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 text-sm text-[var(--text-secondary)]">
                No individual findings were returned.
              </div>
            ) : (
              <div className="space-y-3">
                {groupedFindings.map((group, index) => {
                  const firstFinding = group[0]

                  return (
                    <details
                      key={firstFinding.id}
                      className="group border border-[var(--border-subtle)]"
                    >
                      <summary className="cursor-pointer list-none p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
                              Claim {index + 1}
                              {group.length > 1 && ` · ${group.length} records`}
                            </p>

                            <p className="mt-2 text-sm font-medium leading-6 text-[var(--text-primary)]">
                              {firstFinding.claim}
                            </p>
                          </div>

                          <StatusBadge status={firstFinding.status} />
                        </div>

                        <p className="mt-3 text-xs text-[var(--accent)]">
                          <span className="group-open:hidden">
                            Expand details
                          </span>

                          <span className="hidden group-open:inline">
                            Collapse details
                          </span>
                        </p>
                      </summary>

                      <div className="space-y-4 border-t border-[var(--border-subtle)] p-4">
                        {group.map((finding) => (
                          <article
                            key={finding.id}
                            className="border border-[var(--border-subtle)] bg-[var(--surface-base)] p-4"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <StatusBadge status={finding.status} />
                            </div>

                            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--text-secondary)]">
                              {finding.explanation}
                            </p>

                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                              <div>
                                <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
                                  Historical evidence
                                </p>

                                <p className="mt-1 text-sm text-[var(--text-primary)]">
                                  {finding.historicalEvidenceIds.length} reference(s)
                                </p>
                              </div>

                              <div>
                                <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
                                  Current evidence
                                </p>

                                <p className="mt-1 text-sm text-[var(--text-primary)]">
                                  {finding.currentEvidenceIds.length} reference(s)
                                </p>
                              </div>
                            </div>

                            <details className="mt-4">
                              <summary className="cursor-pointer text-xs font-medium text-[var(--text-muted)]">
                                Technical finding details
                              </summary>

                              <div className="mt-3 space-y-3">
                                <div>
                                  <p className="text-xs text-[var(--text-muted)]">
                                    Finding ID
                                  </p>

                                  <code className="mt-1 block break-all text-xs text-[var(--text-secondary)]">
                                    {finding.id}
                                  </code>
                                </div>

                                <div>
                                  <p className="text-xs text-[var(--text-muted)]">
                                    Historical evidence IDs
                                  </p>

                                  {finding.historicalEvidenceIds.length === 0 ? (
                                    <p className="mt-1 text-xs text-[var(--text-secondary)]">
                                      None
                                    </p>
                                  ) : (
                                    finding.historicalEvidenceIds.map((id) => (
                                      <code
                                        key={id}
                                        className="mt-1 block break-all text-xs text-[var(--text-secondary)]"
                                      >
                                        {id}
                                      </code>
                                    ))
                                  )}
                                </div>

                                <div>
                                  <p className="text-xs text-[var(--text-muted)]">
                                    Current evidence IDs
                                  </p>

                                  {finding.currentEvidenceIds.length === 0 ? (
                                    <p className="mt-1 text-xs text-[var(--text-secondary)]">
                                      None
                                    </p>
                                  ) : (
                                    finding.currentEvidenceIds.map((id) => (
                                      <code
                                        key={id}
                                        className="mt-1 block break-all text-xs text-[var(--text-secondary)]"
                                      >
                                        {id}
                                      </code>
                                    ))
                                  )}
                                </div>
                              </div>
                            </details>
                          </article>
                        ))}
                      </div>
                    </details>
                  )
                })}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Evidence comparisons"
            description="Comparison records are grouped by outcome so evidence churn is easier to inspect."
          >
            {result.comparisons.length === 0 ? (
              <div className="border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 text-sm text-[var(--text-secondary)]">
                No comparison records were returned.
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(comparisonCounts).map(([status, count]) => {
                  const items = result.comparisons.filter(
                    (comparison) => comparison.status === status,
                  )

                  return (
                    <div key={status}>
                      <div className="mb-3 flex flex-wrap items-center gap-3">
                        <StatusBadge status={status} />

                        <span className="text-sm text-[var(--text-secondary)]">
                          {count} comparison(s)
                        </span>
                      </div>

                      <div className="space-y-3">
                        {items.map((comparison) => (
                          <article
                            key={comparison.id}
                            className="border border-[var(--border-subtle)] p-4"
                          >
                            <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--text-secondary)]">
                              {comparison.explanation}
                            </p>

                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                              <div className="border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3">
                                <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
                                  Historical evidence
                                </p>

                                <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
                                  {comparison.historicalEvidenceIds.length}
                                </p>
                              </div>

                              <div className="border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3">
                                <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
                                  Current evidence
                                </p>

                                <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
                                  {comparison.currentEvidenceIds.length}
                                </p>
                              </div>
                            </div>

                            <p className="mt-3 text-xs text-[var(--text-secondary)]">
                              Compared at {formatDate(comparison.comparedAt)}
                            </p>

                            <details className="mt-3">
                              <summary className="cursor-pointer text-xs font-medium text-[var(--text-muted)]">
                                Technical comparison details
                              </summary>

                              <div className="mt-3 space-y-3">
                                <div>
                                  <p className="text-xs text-[var(--text-muted)]">
                                    Comparison ID
                                  </p>

                                  <code className="mt-1 block break-all text-xs text-[var(--text-secondary)]">
                                    {comparison.id}
                                  </code>
                                </div>

                                <div>
                                  <p className="text-xs text-[var(--text-muted)]">
                                    Historical evidence IDs
                                  </p>

                                  {comparison.historicalEvidenceIds.length === 0 ? (
                                    <p className="mt-1 text-xs text-[var(--text-secondary)]">
                                      None
                                    </p>
                                  ) : (
                                    comparison.historicalEvidenceIds.map((id) => (
                                      <code
                                        key={id}
                                        className="mt-1 block break-all text-xs text-[var(--text-secondary)]"
                                      >
                                        {id}
                                      </code>
                                    ))
                                  )}
                                </div>

                                <div>
                                  <p className="text-xs text-[var(--text-muted)]">
                                    Current evidence IDs
                                  </p>

                                  {comparison.currentEvidenceIds.length === 0 ? (
                                    <p className="mt-1 text-xs text-[var(--text-secondary)]">
                                      None
                                    </p>
                                  ) : (
                                    comparison.currentEvidenceIds.map((id) => (
                                      <code
                                        key={id}
                                        className="mt-1 block break-all text-xs text-[var(--text-secondary)]"
                                      >
                                        {id}
                                      </code>
                                    ))
                                  )}
                                </div>
                              </div>
                            </details>
                          </article>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Technical references"
            description="IDs are available when debugging or tracing persisted verification records."
          >
            <details>
              <summary className="cursor-pointer text-sm font-medium text-[var(--text-primary)]">
                Show snapshot and verification IDs
              </summary>

              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    Historical snapshot
                  </p>

                  <code className="mt-1 block break-all text-xs text-[var(--text-secondary)]">
                    {result.verification.historicalSnapshotId}
                  </code>
                </div>

                {result.verification.currentSnapshotId && (
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
                      Fresh snapshot
                    </p>

                    <code className="mt-1 block break-all text-xs text-[var(--text-secondary)]">
                      {result.verification.currentSnapshotId}
                    </code>
                  </div>
                )}

                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    Verification ID
                  </p>

                  <code className="mt-1 block break-all text-xs text-[var(--text-secondary)]">
                    {result.verification.id}
                  </code>
                </div>
              </div>
            </details>
          </SectionCard>
        </section>
      )}
    </div>
  )
}

export default VerificationWorkspace