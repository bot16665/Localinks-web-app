'use client'

import { useEffect } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'

interface LocationPickerMapProps {
  latitude: number | null
  longitude: number | null
  onPositionChange: (latitude: number, longitude: number) => void
}

const markerIcon = L.divIcon({
  className: 'location-map-marker',
  html: '<span></span>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
})

function MapInteractions({
  position,
  onPositionChange,
}: {
  position: [number, number] | null
  onPositionChange: LocationPickerMapProps['onPositionChange']
}) {
  const map = useMap()

  useEffect(() => {
    if (position) map.setView(position, Math.max(map.getZoom(), 13), { animate: true })
  }, [map, position])

  useMapEvents({
    click(event) {
      onPositionChange(event.latlng.lat, event.latlng.lng)
    },
  })

  return null
}

export default function LocationPickerMap({ latitude, longitude, onPositionChange }: LocationPickerMapProps) {
  const position: [number, number] | null = latitude === null || longitude === null ? null : [latitude, longitude]
  const initialCenter: [number, number] = position || [20.5937, 78.9629]

  return (
    <MapContainer center={initialCenter} zoom={position ? 13 : 4} scrollWheelZoom className="location-picker-map">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <MapInteractions position={position} onPositionChange={onPositionChange} />
      {position && (
        <Marker
          position={position}
          icon={markerIcon}
          draggable
          eventHandlers={{
            dragend(event) {
              const markerPosition = event.target.getLatLng()
              onPositionChange(markerPosition.lat, markerPosition.lng)
            },
          }}
        />
      )}
    </MapContainer>
  )
}