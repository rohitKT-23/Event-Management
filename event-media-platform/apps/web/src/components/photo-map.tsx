'use client';

import * as React from 'react';
import Link from 'next/link';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export type GeoMedia = {
  id: string;
  thumbnailUrl: string | null;
  aiCaption: string | null;
  gpsLatitude: number;
  gpsLongitude: number;
};

const pinIcon = L.divIcon({
  className: '',
  html: '<div style="width:18px;height:18px;border-radius:50% 50% 50% 0;background:#7c3aed;transform:rotate(-45deg);border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 18],
  popupAnchor: [0, -16],
});

export default function PhotoMap({ media }: { media: GeoMedia[] }) {
  const center = React.useMemo<[number, number]>(() => {
    if (!media.length) return [20, 0];
    const lat = media.reduce((s, m) => s + m.gpsLatitude, 0) / media.length;
    const lng = media.reduce((s, m) => s + m.gpsLongitude, 0) / media.length;
    return [lat, lng];
  }, [media]);

  return (
    <MapContainer center={center} zoom={media.length ? 13 : 2} className="h-[70vh] w-full rounded-xl" scrollWheelZoom>
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {media.map((m) => (
        <Marker key={m.id} position={[m.gpsLatitude, m.gpsLongitude]} icon={pinIcon}>
          <Popup>
            <Link href={`/media/${m.id}`} className="block w-40">
              {m.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.thumbnailUrl} alt="" className="mb-1 h-24 w-40 rounded object-cover" />
              ) : null}
              <span className="text-xs">{m.aiCaption ?? 'View photo'}</span>
            </Link>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
