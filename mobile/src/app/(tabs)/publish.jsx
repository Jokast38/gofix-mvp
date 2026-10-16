import { Redirect } from "expo-router";

// Placeholder route behind the center tab button (the button navigates by itself).
export default function Publish() {
  return <Redirect href="/requests?new=1" />;
}
