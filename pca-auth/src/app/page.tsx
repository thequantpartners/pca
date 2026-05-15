import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <section className="panel">
        <h1>PCA Auth</h1>
        <p>
          Browser authentication service for the PCA CLI. Start from your terminal with{" "}
          <code>pca login</code>.
        </p>
        <Link className="button" href="/cli/login">
          Open CLI Login
        </Link>
      </section>
    </main>
  );
}
