import { RepositoryProvider } from "@/repositories";
import { NewOrderForm } from "@/components/confeiteira/NewOrderForm";

export default function Page() {
  return (
    <RepositoryProvider mode="demo">
      <NewOrderForm />
    </RepositoryProvider>
  );
}
