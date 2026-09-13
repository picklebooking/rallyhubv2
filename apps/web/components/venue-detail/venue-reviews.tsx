import { RiStarFill } from "@remixicon/react"

const REVIEWS = [
  {
    name: "Mateo S.",
    dupr: "DUPR 4.2",
    timeAgo: "2 days ago",
    quote:
      "The AC in this facility is incredible for Cebu heat. Court 2's replay camera helped me challenge two tight out-balls in our tournament qualifier.",
  },
  {
    name: "Bea Alvarez",
    dupr: "DUPR 3.5",
    timeAgo: "1 week ago",
    quote:
      "Automated gate PIN via SMS was so smooth — no waiting in line at the desk. Clean locker rooms and great coffee at the mezzanine lounge.",
  },
  {
    name: "Carlo G.",
    dupr: "DUPR 3.8",
    timeAgo: "2 weeks ago",
    quote:
      "The 8mm Acrytech surface is incredible for singles. My knees normally ache after hours of singles, but here the cushion bounce makes a massive difference.",
  },
]

function VenueReviews() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-primary text-xs font-semibold tracking-wide uppercase">
            Community feedback
          </p>
          <h2 className="font-heading text-xl font-semibold">
            Verified player reviews (380)
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-lg font-black">4.9</span>
          <div className="flex text-amber-500">
            {Array.from({ length: 5 }).map((_, i) => (
              <RiStarFill key={i} className="size-4" />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {REVIEWS.map((review) => (
          <div key={review.name} className="border-t-4 border-primary bg-card rounded-xl p-5">
            <div className="flex text-amber-500">
              {Array.from({ length: 5 }).map((_, i) => (
                <RiStarFill key={i} className="size-3.5" />
              ))}
            </div>
            <p className="mt-2.5 text-sm leading-relaxed">
              &ldquo;{review.quote}&rdquo;
            </p>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm font-semibold">
                {review.name}{" "}
                <span className="text-muted-foreground font-normal">
                  ({review.dupr})
                </span>
              </span>
              <span className="text-muted-foreground text-xs">
                {review.timeAgo}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export { VenueReviews }
