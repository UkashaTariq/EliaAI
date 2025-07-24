import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Html, Head, Main, NextScript } from "next/document";

const queryClient = new QueryClient();

export default function Document() {
  return (
    <QueryClientProvider client={queryClient}>
      <Html lang="en">
        <Head />
        <body className="antialiased">
          <Main />
          <NextScript />
        </body>
      </Html>
    </QueryClientProvider>
  );
}
