/**
 * Stock court photography (Unsplash, free to use) for venue/facility card
 * thumbnails and galleries. Swap these for real venue photos once available.
 */
const COURT_IMAGES = {
  aerialNight:
    "https://images.unsplash.com/photo-1778180883807-19962eda4d99?w=1200&q=80&auto=format&fit=crop",
  blueLines:
    "https://images.unsplash.com/photo-1617144520113-88ae706a86eb?w=1200&q=80&auto=format&fit=crop",
  courtCorner:
    "https://images.unsplash.com/photo-1520733772731-e33af4616207?w=1200&q=80&auto=format&fit=crop",
  aerialCyan:
    "https://images.unsplash.com/photo-1515017804404-92b19fdfe6ac?w=1200&q=80&auto=format&fit=crop",
  ballOnCourt:
    "https://images.unsplash.com/photo-1541744573515-478c959628a0?w=1200&q=80&auto=format&fit=crop",
  aerialThreeCourts:
    "https://images.unsplash.com/photo-1761927055615-f59ae714385b?w=1200&q=80&auto=format&fit=crop",
  aerialGoldenHour:
    "https://images.unsplash.com/photo-1678734491865-d4dc8a5f5399?w=1200&q=80&auto=format&fit=crop",
} as const

const COURT_IMAGE_LIST = Object.values(COURT_IMAGES)

export { COURT_IMAGES, COURT_IMAGE_LIST }
