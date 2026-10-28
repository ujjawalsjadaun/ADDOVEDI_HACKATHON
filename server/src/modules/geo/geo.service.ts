import type { MapData } from '@golden-hour/shared';
import type { Config } from '../../config/env';
import { fromGeoPoint } from '../../lib/geo';
import { isSimulatedRouting } from '../../providers/routing/routing.provider';
import { getWeatherProvider } from '../../providers/weather/weather.provider';
import type { AuthUser } from '../auth/auth.types';
import { HospitalModel } from '../hospitals/hospital.model';
import { BloodRequestModel } from '../requests/request.model';
import { listRoadReports } from '../roads/roadReport.service';
import { UserModel } from '../users/user.model';

/** Map layers for staff, coordinators and admins. Never contains donor locations. */
export async function getMapData(user: AuthUser, config: Config): Promise<MapData> {
  const [facilities, counts, roadReports] = await Promise.all([
    HospitalModel.find({ verificationStatus: 'verified' }).limit(300),
    BloodRequestModel.aggregate<{ _id: unknown; n: number }>([
      { $match: { isActive: true, verificationStatus: 'verified' } },
      { $group: { _id: '$facilityId', n: { $sum: 1 } } },
    ]),
    listRoadReports(user),
  ]);
  const active = new Map(counts.map((c) => [String(c._id), c.n]));
  const reporterIds = facilities.map((f) => f.ambulanceAccessPoint?.reportedBy).filter(Boolean);
  const reporters = await UserModel.find({ _id: { $in: reporterIds } }).select('name').lean();
  const reporterName = new Map(reporters.map((u) => [u._id.toString(), u.name]));
  const weather = getWeatherProvider(config);

  return {
    generatedAt: new Date().toISOString(),
    facilities: facilities.map((f) => ({
      id: f._id.toString(),
      name: f.name,
      district: f.district,
      facilityType: f.facilityType,
      location: fromGeoPoint(f.location),
      accessPoint: f.ambulanceAccessPoint
        ? {
            location: fromGeoPoint(f.ambulanceAccessPoint.location),
            note: f.ambulanceAccessPoint.note ?? null,
            reportedBy: reporterName.get(f.ambulanceAccessPoint.reportedBy.toString()) ?? null,
            reportedAt: f.ambulanceAccessPoint.reportedAt.toISOString(),
          }
        : null,
      activeRequests: active.get(f._id.toString()) ?? 0,
    })),
    roadReports,
    providers: {
      routing: { name: isSimulatedRouting(config) ? 'simulated' : config.ROUTING_PROVIDER, simulated: isSimulatedRouting(config) },
      weather: { name: weather.name, simulated: weather.simulated },
    },
    closureCorridorKm: config.ROAD_REPORT_CORRIDOR_KM,
  };
}
