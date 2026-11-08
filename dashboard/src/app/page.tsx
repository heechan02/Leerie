import { Landing } from "@/components/landing/Landing";
import { SurveyNumbersProvider } from "@/components/landing/SurveyNumbers";

export default function Page() {
  return <SurveyNumbersProvider><Landing /></SurveyNumbersProvider>;
}
