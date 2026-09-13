function VenueGallery() {
  return (
    <div className="grid h-80 grid-cols-3 grid-rows-2 gap-2 overflow-hidden rounded-2xl sm:h-96">
      <div className="col-span-2 row-span-2 bg-gradient-to-br from-primary/40 via-primary/20 to-brand-ink/20" />
      <div className="col-span-1 row-span-1 bg-gradient-to-br from-primary/40 via-primary/20 to-brand-ink/20" />
      <div className="col-span-1 row-span-1 bg-gradient-to-br from-primary/40 via-primary/20 to-brand-ink/20" />
    </div>
  )
}

export { VenueGallery }
