import { useEffect, useRef, type ReactNode } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import type { LatLng } from '@golden-hour/shared';
import 'leaflet/dist/leaflet.css';

/** Default view: Arunachal Pradesh hill districts. */
const DEFAULT_CENTER: [number, number] = [28.0, 94.5];

interface MapViewProps {
  /** Points to fit in view on first render (facilities, reports…). */
  fitTo?: LatLng[];
  /** Called with the clicked position when the user is picking a location. */
  onPick?: (at: LatLng) => void;
  height?: string;
  children?: ReactNode;
  label: string;
}

function FitOnce({ points }: { points: LatLng[] }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || points.length === 0) return;
    done.current = true;
    if (points.length === 1) map.setView([points[0]!.lat, points[0]!.lng], 12);
    else map.fitBounds(points.map((p) => [p.lat, p.lng] as [number, number]), { padding: [30, 30], maxZoom: 13 });
  }, [map, points]);
  return null;
}

function PickHandler({ onPick }: { onPick: (at: LatLng) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: Math.round(e.latlng.lat * 1e5) / 1e5, lng: Math.round(e.latlng.lng * 1e5) / 1e5 }) });
  return null;
}

/** OpenStreetMap base map. Markers are passed as children (CircleMarker etc.); no image assets needed. */
export function MapView({ fitTo = [], onPick, height = '420px', children, label }: MapViewProps) {
  return (
    <div role="region" aria-label={label} className="overflow-hidden rounded-lg border border-slate-200" style={{ height }}>
      <MapContainer center={DEFAULT_CENTER} zoom={7} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitOnce points={fitTo} />
        {onPick && <PickHandler onPick={onPick} />}
        {children}
      </MapContainer>
    </div>
  );
}
