import { ComingSoon } from '../../components/ui/ComingSoon';

export function CheckerPage() {
  return (
    <ComingSoon
      title="Is this request real?"
      phase={4}
      description="Enter the GH-XXXX-XXXX code from an alert to see whether it is verified, still active or closed."
    />
  );
}
