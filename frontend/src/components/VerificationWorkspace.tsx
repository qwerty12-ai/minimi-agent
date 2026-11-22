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
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    case 'changed':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
    case 'unsupported':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
    case 'historical_only':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
    case 'current_only':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
  }
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusClasses(status)}`}>
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
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-6">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
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
        if (current && response.snapshots.some((snapshot) => snapshot.id === current)) {
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

  // Consolidate repeated claims for a more readable findings workspace.
  const groupedFindings = useMemo(() => {
    if (!result) return []

    const groups = new Map<
      string,
      typeof result.verification.findings
    >()

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
    <div className="mx-auto w-full max-w-5xl space-y-8 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <header className="space-y-2">
        <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
          Research integrity
        </p>

        <h1 className="text-3xl font-bold tracking-tight">
          Verification
        </h1>

        <p className="max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-400">
          Revisit historical research and compare it against fresh evidence
          to identify what has changed, what remains consistent, and what
          can no longer be supported.
        </p>
      </header>

      {/* Snapshot selection */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              Verify historical research
            </h2>

            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Select a previously recorded research snapshot.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadSnapshots()}
            disabled={loadingSnapshots}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            {loadingSnapshots ? 'Refreshing...' : 'Refresh snapshots'}
          </button>
        </div>

        {loadingSnapshots && snapshots.length === 0 && (
          <div className="rounded-xl bg-gray-50 p-6 text-center text-sm text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
            Loading historical research...
          </div>
        )}

        {snapshotError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            <p className="font-medium">Could not load snapshots</p>
            <p className="mt-1">{snapshotError}</p>
          </div>
        )}

        {!loadingSnapshots && !snapshotError && snapshots.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
            <h3 className="font-medium">No historical research available</h3>

            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
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
                className="mb-2 block text-sm font-medium"
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
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-950"
              >
                {snapshots.map((snapshot) => (
                  <option key={snapshot.id} value={snapshot.id}>
                    {snapshot.query} — {formatDate(snapshot.recordedAt)}
                  </option>
                ))}
              </select>
            </div>

            {selectedSnapshot && (
              <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800/50">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Original query
                    </p>
                    <p className="mt-1 text-sm font-medium">
                      {selectedSnapshot.query}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Provider
                      </p>
                      <p className="mt-1 text-sm">
                        {selectedSnapshot.provider}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Originally searched
                      </p>
                      <p className="mt-1 text-sm">
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
                className="mb-2 block text-sm font-medium"
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
                className="w-full resize-y rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-950"
              />

              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                When provided, this question is used to focus verification
                against the selected historical research.
              </p>
            </div>

            {verificationError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                <p className="font-medium">Verification failed</p>
                <p className="mt-1">{verificationError}</p>
              </div>
            )}

            <button
              type="button"
              onClick={() => void handleVerify()}
              disabled={!selectedSnapshotId || verifying || loadingSnapshots}
              className="inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {verifying
                ? 'Verifying against fresh research...'
                : 'Verify selected research'}
            </button>

            {verifying && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                MiniMi is retrieving fresh evidence and comparing it with
                the historical snapshot. This may take a while.
              </p>
            )}
          </div>
        )}
      </section>

      {/* Results */}
      {result && (
        <section className="space-y-6">
          {/* Summary */}
          <SectionCard title="Verification summary">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Overall result
                </p>
                <div className="mt-2">
                  <StatusBadge status={result.verification.status} />
                </div>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Verified at
                </p>
                <p className="mt-2 text-sm">
                  {formatDate(result.verification.verifiedAt)}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-xl bg-gray-50 p-4 dark:bg-gray-800/50">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Verified query
              </p>
              <p className="mt-2 text-sm leading-6">
                {result.verification.query}
              </p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Findings
                </p>
                <p className="mt-2 text-2xl font-bold">
                  {result.verification.findings.length}
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Unique claims
                </p>
                <p className="mt-2 text-2xl font-bold">
                  {groupedFindings.length}
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Comparisons
                </p>
                <p className="mt-2 text-2xl font-bold">
                  {result.comparisons.length}
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Evidence records
                </p>
                <p className="mt-2 text-2xl font-bold">
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
              <p className="text-sm font-medium">
                Comparison status breakdown
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(comparisonCounts).map(([status, count]) => (
                  <div
                    key={status}
                    className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-800"
                  >
                    <StatusBadge status={status} />
                    <span className="text-sm font-semibold">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
              <p className="font-semibold">How to interpret this result</p>
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

          {/* Consolidated findings */}
          <SectionCard
            title="Findings"
            description="Repeated claims are grouped together to reduce noise. Expand a claim to inspect its individual findings."
          >
            {groupedFindings.length === 0 ? (
              <div className="rounded-xl bg-gray-50 p-5 text-sm text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
                No individual findings were returned.
              </div>
            ) : (
              <div className="space-y-3">
                {groupedFindings.map((group, index) => {
                  const firstFinding = group[0]

                  return (
                    <details
                      key={firstFinding.id}
                      className="group rounded-xl border border-gray-200 dark:border-gray-800"
                    >
                      <summary className="cursor-pointer list-none p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                              Claim {index + 1}
                              {group.length > 1 && ` · ${group.length} records`}
                            </p>

                            <p className="mt-2 text-sm font-medium leading-6">
                              {firstFinding.claim}
                            </p>
                          </div>

                          <StatusBadge status={firstFinding.status} />
                        </div>

                        <p className="mt-3 text-xs text-indigo-600 dark:text-indigo-400">
                          <span className="group-open:hidden">
                            Expand details
                          </span>
                          <span className="hidden group-open:inline">
                            Collapse details
                          </span>
                        </p>
                      </summary>

                      <div className="space-y-4 border-t border-gray-200 p-4 dark:border-gray-800">
                        {group.map((finding) => (
                          <article
                            key={finding.id}
                            className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800/50"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <StatusBadge status={finding.status} />
                            </div>

                            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-700 dark:text-gray-300">
                              {finding.explanation}
                            </p>

                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                              <div>
                                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                  Historical evidence
                                </p>
                                <p className="mt-1 text-sm">
                                  {finding.historicalEvidenceIds.length} reference(s)
                                </p>
                              </div>

                              <div>
                                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                  Current evidence
                                </p>
                                <p className="mt-1 text-sm">
                                  {finding.currentEvidenceIds.length} reference(s)
                                </p>
                              </div>
                            </div>

                            <details className="mt-4">
                              <summary className="cursor-pointer text-xs font-medium text-gray-500 dark:text-gray-400">
                                Technical finding details
                              </summary>

                              <div className="mt-3 space-y-3">
                                <div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Finding ID
                                  </p>
                                  <code className="mt-1 block break-all text-xs">
                                    {finding.id}
                                  </code>
                                </div>

                                <div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Historical evidence IDs
                                  </p>
                                  {finding.historicalEvidenceIds.length === 0 ? (
                                    <p className="mt-1 text-xs">None</p>
                                  ) : (
                                    finding.historicalEvidenceIds.map((id) => (
                                      <code key={id} className="mt-1 block break-all text-xs">
                                        {id}
                                      </code>
                                    ))
                                  )}
                                </div>

                                <div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Current evidence IDs
                                  </p>
                                  {finding.currentEvidenceIds.length === 0 ? (
                                    <p className="mt-1 text-xs">None</p>
                                  ) : (
                                    finding.currentEvidenceIds.map((id) => (
                                      <code key={id} className="mt-1 block break-all text-xs">
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

          {/* Comparisons grouped by status */}
          <SectionCard
            title="Evidence comparisons"
            description="Comparison records are grouped by outcome so evidence churn is easier to inspect."
          >
            {result.comparisons.length === 0 ? (
              <div className="rounded-xl bg-gray-50 p-5 text-sm text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
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
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {count} comparison(s)
                        </span>
                      </div>

                      <div className="space-y-3">
                        {items.map((comparison) => (
                          <article
                            key={comparison.id}
                            className="rounded-xl border border-gray-200 p-4 dark:border-gray-800"
                          >
                            <p className="whitespace-pre-wrap text-sm leading-6 text-gray-700 dark:text-gray-300">
                              {comparison.explanation}
                            </p>

                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
                                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                  Historical evidence
                                </p>
                                <p className="mt-2 text-sm font-semibold">
                                  {comparison.historicalEvidenceIds.length}
                                </p>
                              </div>

                              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
                                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                  Current evidence
                                </p>
                                <p className="mt-2 text-sm font-semibold">
                                  {comparison.currentEvidenceIds.length}
                                </p>
                              </div>
                            </div>

                            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                              Compared at {formatDate(comparison.comparedAt)}
                            </p>

                            <details className="mt-3">
                              <summary className="cursor-pointer text-xs font-medium text-gray-500 dark:text-gray-400">
                                Technical comparison details
                              </summary>

                              <div className="mt-3 space-y-3">
                                <div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Comparison ID
                                  </p>
                                  <code className="mt-1 block break-all text-xs">
                                    {comparison.id}
                                  </code>
                                </div>

                                <div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Historical evidence IDs
                                  </p>
                                  {comparison.historicalEvidenceIds.length === 0 ? (
                                    <p className="mt-1 text-xs">None</p>
                                  ) : (
                                    comparison.historicalEvidenceIds.map((id) => (
                                      <code key={id} className="mt-1 block break-all text-xs">
                                        {id}
                                      </code>
                                    ))
                                  )}
                                </div>

                                <div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Current evidence IDs
                                  </p>
                                  {comparison.currentEvidenceIds.length === 0 ? (
                                    <p className="mt-1 text-xs">None</p>
                                  ) : (
                                    comparison.currentEvidenceIds.map((id) => (
                                      <code key={id} className="mt-1 block break-all text-xs">
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

          {/* Technical references */}
          <SectionCard
            title="Technical references"
            description="IDs are available when debugging or tracing persisted verification records."
          >
            <details>
              <summary className="cursor-pointer text-sm font-medium">
                Show snapshot and verification IDs
              </summary>

              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Historical snapshot
                  </p>
                  <code className="mt-1 block break-all text-xs">
                    {result.verification.historicalSnapshotId}
                  </code>
                </div>

                {result.verification.currentSnapshotId && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Fresh snapshot
                    </p>
                    <code className="mt-1 block break-all text-xs">
                      {result.verification.currentSnapshotId}
                    </code>
                  </div>
                )}

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Verification ID
                  </p>
                  <code className="mt-1 block break-all text-xs">
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