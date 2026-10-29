import { CircleMarker, Polyline, Popup } from 'react-leaflet';
import type { LatLng } from '@golden-hour/shared';
import { MapView } from '../../components/map/MapView';

/**
 * Where the donor is going. Shows the donor's OWN approximate position (already rounded to about 1 km) and the
 * hospital they accepted for. The line is straight, not the road: the travel time next to it is the road estimate.
 * Loaded lazily so the map library is not part of the first page.
 */
export default function DonorRouteMap({ from, to, hospitalName }: { from: LatLng | null; to: LatLng; hospitalName: string }) {
  return (
    <div className="space-y-1.5">
      <MapView fitTo={from ? [from, to] : [to]} height="14rem" label={`Map from your area to ${hospitalName}`}>
        {from && (
          <>
            <Polyline positions={[[from.lat, from.lng], [to.lat, to.lng]]} pathOptions={{ color: '#64748b', weight: 2, dashArray: '6 6' }} />
            <CircleMarker center={[from.lat, from.lng]} radius={8} pathOptions={{ color: '#7c3aed', fillColor: '#7c3aed', fillOpacity: 0.85 }}>
              <Popup>Your approximate position</Popup>
            </CircleMarker>
          </>
        )}
        <CircleMarker center={[to.lat, to.lng]} radius={10} pathOptions={{ color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.9 }}>
          <Popup>{hospitalName}</Popup>
        </CircleMarker>
      </MapView>
      <p className="text-2xs text-slate-500">Dashed line is straight, not the road. Your position is shown rounded to about 1 km and is visible only to you.</p>
    </div>
  );
}
