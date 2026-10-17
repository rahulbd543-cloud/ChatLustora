import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.js';
import { ReportItem, ModerationAuditLog } from '../../shared/types.js';
import {
  ShieldAlert,
  AlertOctagon,
  Clock,
  Slash,
  CheckCircle,
  FileText,
  UserCheck
} from 'lucide-react';

export const ModerationPanel: React.FC = () => {
  const { session, t } = useApp();

  const [reports, setReports] = useState<ReportItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<ModerationAuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchModerationData = () => {
    if (!session?.token) return;
    setLoading(true);

    fetch('/api/moderation/reports', {
      headers: { Authorization: `Bearer ${session.token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.reports) setReports(data.reports);
      })
      .catch(() => {});

    fetch('/api/moderation/audit-logs', {
      headers: { Authorization: `Bearer ${session.token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.logs) setAuditLogs(data.logs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchModerationData();
  }, [session?.token]);

  const handleAction = async (action: 'warn' | 'mute' | 'ban' | 'dismiss', report: ReportItem) => {
    try {
      await fetch('/api/moderation/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.token}`
        },
        body: JSON.stringify({
          action,
          targetId: report.targetId,
          targetNickname: report.targetNickname,
          reportId: report.id,
          reason: `Violation reported: ${report.reason}`
        })
      });

      fetchModerationData();
    } catch {}
  };

  if (session?.role !== 'admin' && session?.role !== 'moderator') {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center text-text-muted">
        <p>Access restricted to ChatLustora moderators and administrators.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-4 sm:p-6 lg:p-8 bg-raised/40">
      <div className="max-w-5xl mx-auto w-full flex flex-col gap-6">
        <div>
          <h2 className="text-2xl font-extrabold text-text-main flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-brand" />
            <span>{t('reportsQueue')}</span>
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Real-time report triage and moderation enforcement. Review abusive conduct, non-consensual content, and underage suspicion.
          </p>
        </div>

        {/* Reports Queue */}
        <div className="flex flex-col gap-3">
          {reports.length === 0 ? (
            <div className="p-8 rounded-2xl bg-raised border border-line text-center text-xs text-text-muted">
              No pending reports in the queue. All community spaces are clean!
            </div>
          ) : (
            reports.map(rep => (
              <div
                key={rep.id}
                className="p-4 rounded-xl bg-raised border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-500 text-[10px] font-bold uppercase">
                      {rep.reason}
                    </span>
                    <span className="text-xs text-text-muted">
                      Reported by <strong className="text-text-main">{rep.reporterNickname}</strong>
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-text-main mt-1">
                    Target: <span className="text-brand">{rep.targetNickname}</span>
                  </p>
                  {rep.notes && (
                    <p className="text-xs text-text-muted italic">
                      "{rep.notes}"
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleAction('warn', rep)}
                    className="px-3 py-1.5 rounded-lg border border-line hover:border-amber-500 text-xs font-semibold text-amber-500"
                  >
                    {t('warnUser')}
                  </button>
                  <button
                    onClick={() => handleAction('mute', rep)}
                    className="px-3 py-1.5 rounded-lg border border-line hover:border-orange-500 text-xs font-semibold text-orange-500"
                  >
                    {t('muteUser')}
                  </button>
                  <button
                    onClick={() => handleAction('ban', rep)}
                    className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-bold hover:bg-red-600"
                  >
                    {t('banUser')}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Audit Logs */}
        <div className="flex flex-col gap-3 mt-4">
          <h3 className="text-base font-bold text-text-main flex items-center gap-2">
            <FileText className="w-4 h-4 text-brand" />
            <span>{t('auditLogs')}</span>
          </h3>

          <div className="rounded-xl border border-line bg-raised overflow-hidden">
            {auditLogs.length === 0 ? (
              <div className="p-4 text-center text-xs text-text-muted">
                No moderation logs recorded yet.
              </div>
            ) : (
              auditLogs.map(log => (
                <div
                  key={log.id}
                  className="p-3 border-b border-line last:border-b-0 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-brand">{log.moderatorNickname}</span>
                    <span className="text-text-muted">performed</span>
                    <span className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 font-mono uppercase text-[10px]">
                      {log.action}
                    </span>
                    <span className="text-text-muted">on</span>
                    <span className="font-bold text-text-main">{log.targetNickname}</span>
                  </div>
                  <span className="text-text-muted text-[10px]">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
