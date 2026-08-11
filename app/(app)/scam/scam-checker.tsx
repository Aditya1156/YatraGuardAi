'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { ClipboardPaste, ShieldCheck } from 'lucide-react';
import { TrustRing } from '@/components/trust-ring';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { EmptyState, ErrorState, InfoNote, ResultSkeleton } from '@/components/ui/feedback';
import { apiSend, errorMessage } from '@/lib/client/api';
import type { ScamCheckResult } from '@/types';

const MAX_LENGTH = 5000;

export function ScamChecker() {
  const [text, setText] = useState('');

  const check = useMutation({
    mutationFn: (message: string) =>
      apiSend<ScamCheckResult>('/api/scam/check', 'POST', { text: message }),
  });

  async function pasteFromClipboard() {
    try {
      const clipboard = await navigator.clipboard.readText();
      if (clipboard) setText(clipboard.slice(0, MAX_LENGTH));
    } catch {
      // Firefox and iOS Safari deny programmatic reads; the textarea still works.
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label htmlFor="message" className="mb-1.5 block text-sm font-medium">
          The message
        </label>
        <Textarea
          id="message"
          value={text}
          maxLength={MAX_LENGTH}
          placeholder={'e.g. "Your KYC has expired. Click here within 24 hours or your account will be blocked."'}
          onChange={(event) => {
            setText(event.target.value);
            if (check.data || check.isError) check.reset();
          }}
        />
        <div className="mt-2 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={pasteFromClipboard}>
            <ClipboardPaste aria-hidden />
            Paste
          </Button>
          <span className="numeric text-xs text-muted-foreground">
            {text.length}/{MAX_LENGTH}
          </span>
        </div>
      </div>

      <Button
        size="lg"
        block
        disabled={text.trim().length < 3}
        loading={check.isPending}
        onClick={() => check.mutate(text.trim())}
      >
        Check this message
      </Button>

      {check.isPending && <ResultSkeleton />}

      {check.isError && (
        <ErrorState
          description={errorMessage(check.error)}
          onRetry={() => check.mutate(text.trim())}
        />
      )}

      {check.data && <ScamResult result={check.data} />}

      {!check.data && !check.isPending && (
        <EmptyState
          icon={ShieldCheck}
          title="Nothing checked yet"
          description="Nothing you paste is shared with anyone. Only suspicious and scam verdicts are kept, and only to warn other travellers in your city."
        />
      )}
    </div>
  );
}

function ScamResult({ result }: { result: ScamCheckResult }) {
  const heading =
    result.category === 'scam'
      ? 'This is a scam'
      : result.category === 'suspicious'
        ? 'Treat this as suspicious'
        : 'Nothing obviously wrong';

  return (
    <section className="flex flex-col gap-4" aria-live="polite">
      <div className="flex flex-col items-center rounded-card bg-surface px-4 py-6 shadow-card">
        <TrustRing score={result.score} size="lg" />
        <h2 className="mt-4 text-lg">{heading}</h2>
        <p className="mt-1.5 text-pretty text-center text-sm text-muted-foreground">
          {result.explanation}
        </p>
      </div>

      {result.signals.length > 0 && (
        <div className="rounded-card bg-surface p-4 shadow-card">
          <h3 className="text-sm">What gave it away</h3>
          <ul className="mt-2 flex flex-col gap-1.5">
            {result.signals.map((signal) => (
              <li key={signal} className="flex gap-2 text-sm text-muted-foreground">
                <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-marigold" />
                {signal}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div
        className={`rounded-card p-4 ${
          result.category === 'safe' ? 'bg-signal-green/10' : 'bg-signal-red/10'
        }`}
      >
        <h3 className="text-sm">What to do</h3>
        <p className="mt-1 text-sm">{result.recommendedAction}</p>
      </div>

      <InfoNote>
        Confidence {Math.round(result.confidence * 100)}%. This is an automated read, not legal
        advice — when money is involved, verify through an official app or number.
      </InfoNote>

      <Button asChild variant="outline" block>
        <Link href="/alerts">See scams reported near you</Link>
      </Button>
    </section>
  );
}
