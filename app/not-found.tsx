import Link from 'next/link';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col justify-center px-6 text-center">
      <Compass className="mx-auto size-8 text-muted-foreground" aria-hidden />
      <h1 className="mt-4 font-display text-xl">Nothing here</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        That page does not exist. It may have been part of an older build.
      </p>
      <Button asChild className="mt-6 self-center">
        <Link href="/dashboard">Back to home</Link>
      </Button>
    </main>
  );
}
