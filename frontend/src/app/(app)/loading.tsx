import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/wheat-sack.png" alt="Dona Don" width={48} height={48} />
      <p className="font-semibold">Dona Don</p>
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
