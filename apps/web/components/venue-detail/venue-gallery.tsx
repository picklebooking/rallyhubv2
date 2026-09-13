import { CourtThumbnail } from "@/components/shared/court-thumbnail"
import { COURT_IMAGES } from "@/lib/court-images"

function VenueGallery() {
  return (
    <div className="grid h-80 grid-cols-3 grid-rows-2 gap-2 overflow-hidden rounded-2xl sm:h-96">
      <div className="relative col-span-2 row-span-2">
        <CourtThumbnail src={COURT_IMAGES.aerialNight} alt="The Baseline Club courts" priority />
      </div>
      <div className="relative col-span-1 row-span-1">
        <CourtThumbnail src={COURT_IMAGES.blueLines} alt="Court surface detail" />
      </div>
      <div className="relative col-span-1 row-span-1">
        <CourtThumbnail src={COURT_IMAGES.ballOnCourt} alt="Court equipment" />
      </div>
    </div>
  )
}

export { VenueGallery }
