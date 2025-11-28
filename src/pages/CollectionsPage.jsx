import React, { useMemo, useState } from "react";
import { useFirebaseList } from "../hooks/useFirebase";
import SectionTitle from "../components/SectionTitle";
import Loader from "../components/Loader";
import { Link } from "react-router-dom";

export default function CollectionsPage() {
  const { data: categories, loading } = useFirebaseList("/categories");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("name_asc");
  const [visible, setVisible] = useState(12);
  const [showSidebar, setShowSidebar] = useState(false);

  // Defensive normalization: categories from Firebase can be an object map or an array
  let cats = [];
  if (categories) {
    if (Array.isArray(categories)) cats = categories;
    else if (typeof categories === "object") cats = Object.values(categories);
    else cats = [];
  }

  const filtered = useMemo(() => {
    let list = cats.slice();
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (c) =>
          (c.name || c.title || "").toLowerCase().includes(q) ||
          (c.description || "").toLowerCase().includes(q)
      );
    }

    switch (sort) {
      case "name_desc":
        list.sort((a, b) =>
          (b.name || b.title || "").localeCompare(a.name || a.title || "")
        );
        break;
      case "newest":
        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        break;
      default:
        list.sort((a, b) =>
          (a.name || a.title || "").localeCompare(b.name || b.title || "")
        );
        break;
    }

    return list;
  }, [cats, query, sort]);

  const visibleItems = filtered.slice(0, visible);

  // Ensure hooks (useMemo) always run before returning — show loader after hooks computed
  if (loading) return <Loader />;

  try {
    return (
      <div className="section-container py-8">
        {/* Hero / Title - with back button */}
        <div className="mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <Link
                to="/"
                aria-label="Back to home"
                title="Back"
                className="p-2 rounded-full bg-primary-600 text-white shadow-md inline-flex items-center justify-center"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </Link>
              <h1 className="text-3xl md:text-4xl font-bold text-primary-900">
                Collections
              </h1>
            </div>
            <p className="text-neutral-600 mt-1">
              Browse curated categories.
            </p>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-3 w-full md:w-auto lg:hidden">
            <div className="relative flex-1 md:flex-none">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search collections..."
                className="form-input header-search w-full md:w-64"
              />
              {query && (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-neutral-500"
                  onClick={() => setQuery("")}
                >
                  Clear
                </button>
              )}
            </div>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="form-input text-sm w-40"
            >
              <option value="name_asc">Name: A → Z</option>
              <option value="name_desc">Name: Z → A</option>
              <option value="newest">Newest</option>
            </select>

            <div className="hidden md:flex items-center gap-2">
              <button
                className="btn btn-ghost"
                onClick={() => setShowSidebar(true)}
              >
                Filters
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setVisible((v) => v + 12)}
              >
                Show more
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sidebar (sticky on large screens) */}
          <aside className="hidden lg:block lg:col-span-3">
            <div className="card p-4 sticky top-24">
              <h4 className="font-semibold mb-3">Filters</h4>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Search</label>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="form-input"
                  placeholder="Search collections"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Sort</label>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="form-input"
                >
                  <option value="name_asc">Name: A → Z</option>
                  <option value="name_desc">Name: Z → A</option>
                  <option value="newest">Newest</option>
                </select>
              </div>

              <div>
                <h5 className="text-sm font-semibold mb-2">Quick links</h5>
                <div className="flex flex-col gap-2">
                  {cats.slice(0, 8).map((c) => (
                    <Link
                      key={c.id}
                      to={`/collections/${c.slug || c.id}`}
                      className="text-sm text-neutral-700 hover:text-primary-600"
                    >
                      {c.name || c.title}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* Grid */}
          <main className="lg:col-span-9">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {visibleItems.map((c) => (
                <Link
                  key={c.id}
                  to={`/collections/${c.slug || c.id}`}
                  className="card overflow-hidden hover:shadow-lg transition-shadow duration-300 p-0"
                >
                  <div className="w-full h-36 bg-neutral-100 overflow-hidden">
                    <img
                      src={c.thumbnail || c.image || "/placeholder.jpg"}
                      alt={c.name || c.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-3">
                    <div className="font-semibold text-sm text-primary-900 leading-tight">
                      {c.name || c.title}
                    </div>
                    {c.description && (
                      <div className="text-xs text-neutral-500 mt-1 line-clamp-2">
                        {c.description}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>

            {filtered.length === 0 && (
              <div className="py-12 text-center text-neutral-500">
                No collections match your search.
              </div>
            )}

            {visible < filtered.length && (
              <div className="mt-6 text-center">
                <button
                  className="btn btn-primary px-6"
                  onClick={() => setVisible((v) => v + 12)}
                >
                  Load more
                </button>
              </div>
            )}
          </main>
        </div>

        {/* Mobile sidebar drawer */}
        {showSidebar && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setShowSidebar(false)}
            />
            <div className="absolute left-0 top-0 h-full w-80 bg-white p-4 overflow-auto">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold">Filters</h4>
                <button
                  className="btn btn-ghost"
                  onClick={() => setShowSidebar(false)}
                >
                  Close
                </button>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Search</label>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="form-input"
                  placeholder="Search collections"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Sort</label>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="form-input"
                >
                  <option value="name_asc">Name: A → Z</option>
                  <option value="name_desc">Name: Z → A</option>
                  <option value="newest">Newest</option>
                </select>
              </div>

              <div>
                <h5 className="text-sm font-semibold mb-2">Quick links</h5>
                <div className="flex flex-col gap-2">
                  {cats.slice(0, 8).map((c) => (
                    <Link
                      key={c.id}
                      to={`/collections/${c.slug || c.id}`}
                      className="text-sm text-neutral-700 hover:text-primary-600"
                      onClick={() => setShowSidebar(false)}
                    >
                      {c.name || c.title}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  } catch (err) {
    console.error("CollectionsPage render error:", err);
    return (
      <div className="section-container py-12">
        <div className="text-center text-red-600">
          An error occurred while rendering Collections. Check console for details.
        </div>
      </div>
    );
  }
}
