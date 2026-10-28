// Registers every Mongoose model so index creation covers all collections.
// Add each new *.model.ts here.
import './audit/audit.model';
import './users/user.model';
import './hospitals/hospital.model';
import './requests/request.model';
import './idempotency/idempotency.model';
import './public-checker/suspiciousReport.model';
import './donors/donor.model';
import './alerts/alert.model';
import './assignments/assignment.model';
import './roads/roadReport.model';
import '../providers/routing/routeCache.model';
