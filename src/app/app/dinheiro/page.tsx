import { RepositoryProvider } from "@/repositories";
import { MoneyPage } from "@/components/confeiteira/MoneyPage";

export default function Page() {
  return (
    <RepositoryProvider mode="app">
      <MoneyPage />
    </RepositoryProvider>
  );
}
