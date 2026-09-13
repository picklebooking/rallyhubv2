import { Button } from "@workspace/ui/components/button"

function OpenPlayCta() {
  return (
    <section className="bg-muted px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 text-center sm:flex-row sm:text-left">
        <div>
          <p className="text-primary text-xs font-semibold tracking-wide uppercase">
            Metro open play mixers
          </p>
          <h2 className="mt-1.5 text-2xl font-black tracking-tight text-balance">
            Don&apos;t have a full 4-player squad? Join open play mixers.
          </h2>
          <p className="text-muted-foreground mt-1.5 max-w-xl text-sm leading-relaxed">
            Drop in as a solo player or with a friend. Rotating king-of-the-court
            queues across IT Park, Mandaue, and Ayala hubs.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-center gap-3">
          <Button size="lg">Browse open mixers</Button>
          <Button size="lg" variant="outline">
            Rating guide
          </Button>
        </div>
      </div>
    </section>
  )
}

export { OpenPlayCta }
