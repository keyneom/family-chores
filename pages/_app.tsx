import "@/styles/globals.css";


import type { AppProps } from "next/app";

import Layout from "@/components/Layout";
import { ChoresAppProvider } from "@/components/ChoresAppContext";


export default function App({ Component, pageProps }: AppProps) {
  return (
    <ChoresAppProvider>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </ChoresAppProvider>
  );
}
