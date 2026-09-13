function VenueGallery() {
  return (
    <div className="grid h-80 grid-cols-3 grid-rows-2 gap-2 overflow-hidden rounded-2xl sm:h-96">
      <div className="bg-muted col-span-2 row-span-2 bg-gradient-to-br from-emerald-500/25 via-emerald-500/10 to-transparent" />
      <div className="bg-muted col-span-1 row-span-1 bg-gradient-to-br from-sky-500/25 via-sky-500/10 to-transparent" />
      <div className="bg-muted col-span-1 row-span-1 bg-gradient-to-br from-amber-500/25 via-amber-500/10 to-transparent" />
    </div>
  )
}

export { VenueGallery }
