'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Category = 'All' | 'Cafes' | 'Restaurants' | 'Groceries' | 'Salon' | 'Services' | 'Retail' | 'Wellness'

const CATEGORIES: Category[] = ['All', 'Cafes', 'Restaurants', 'Groceries', 'Salon', 'Services', 'Retail', 'Wellness']

interface Business {
  id: string
  name: string
  category: Category
  address: string | null
  is_open: boolean
  distance_km: number
}

interface BusinessFeedPageProps {
  embedded?: boolean
}

export default function BusinessFeedPage({ embedded = false }: BusinessFeedPageProps) {
  const router = useRouter()
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<Category>('All')
  const [searchQuery, setSearchQuery] = useState('')

  const fetchBusinesses = async (category: Category) => {
    setLoading(true)
    setError(null)

    const supabase = createClient()
    try {
      const { data, error: rpcError } = await supabase.rpc('nearby_businesses', {
        radius_km: 10,
        filter_category: category === 'All' ? null : category,
      })

      if (!rpcError && data && data.length > 0) {
        setBusinesses((data ?? []) as Business[])
        setLoading(false)
        return
      }
    } catch {
      // Fall through to direct query
    }

    // Direct query fallback
    let query = supabase.from('businesses').select('*').order('created_at', { ascending: false })
    if (category !== 'All') {
      query = query.eq('category', category)
    }
    const { data: directBusinesses, error: directError } = await query

    if (directError) {
      setError('Failed to load businesses')
    } else if (directBusinesses) {
      const mapped = directBusinesses.map((b: any) => ({
        id: b.id,
        name: b.name,
        category: b.category,
        address: b.address,
        is_open: b.is_open ?? true,
        distance_km: 0.8,
      }))
      setBusinesses(mapped as Business[])
    }

    setLoading(false)
  }

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        router.push('/login')
        return
      }

      await fetchBusinesses(selectedCategory)
    }

    load()
  }, [router, selectedCategory])

  const filteredBusinesses = useMemo(() => {
    let result = businesses
    if (selectedCategory !== 'All') {
      result = result.filter((business) => business.category === selectedCategory)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter((b) => b.name.toLowerCase().includes(q))
    }
    return result
  }, [businesses, selectedCategory, searchQuery])

  const mainContent = (
    <div className="w-full flex flex-col">
      {/* Header Section: Search + Filters */}
      <div className={`w-full bg-background/95 backdrop-blur-md sticky ${embedded ? 'top-0' : 'top-0'} z-30 py-2 border-b border-outline-variant/30`}>
        {/* Search Bar */}
        <div className="relative w-full mb-2">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none text-xl">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 bg-surface-container-low pl-10 pr-4 rounded-2xl text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary border border-outline-variant/30 text-sm transition-all"
            placeholder="Search local businesses..."
            aria-label="Search businesses"
          />
        </div>
        
        {/* Filter Chips */}
        <div className="flex overflow-x-auto hide-scrollbar gap-2 px-1 pb-1">
          {CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setSelectedCategory(category)}
              className={`flex-shrink-0 px-4 py-2 rounded-full whitespace-nowrap font-medium text-xs sm:text-sm active:scale-95 transition-all touch-target ${
                selectedCategory === category
                  ? 'bg-primary-container text-on-primary-container shadow-sm'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-4 flex flex-col sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {error && (
          <div className="sm:col-span-full rounded-2xl border border-error/30 bg-error-container/20 p-4 text-center font-medium text-error text-sm">
            {error}
          </div>
        )}

        {!error && loading && (
          <>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-56 animate-pulse rounded-2xl bg-surface-container-low border border-outline-variant/20" />
            ))}
          </>
        )}

        {!error && !loading && filteredBusinesses.length === 0 && (
          <div className="sm:col-span-full flex flex-col items-center justify-center py-16 sm:py-24 text-center">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant/40 mb-3">storefront</span>
            <p className="text-lg sm:text-xl font-semibold text-on-surface mb-1">No businesses found</p>
            <p className="text-xs sm:text-sm text-on-surface-variant">Try a different search or category filter</p>
          </div>
        )}

        {!error && !loading && filteredBusinesses.length > 0 &&
          filteredBusinesses.map((business) => (
            <Link
              href={`/business/${business.id}`}
              key={business.id}
              className="bg-surface-container-low rounded-2xl overflow-hidden flex flex-col hover:border-primary/40 border border-outline-variant/30 hover:shadow-lg active:scale-[0.98] transition-all duration-200 group"
            >
              {/* Cover Banner */}
              <div className="relative w-full h-36 sm:h-40 bg-gradient-to-br from-surface-container to-surface-container-high overflow-hidden flex items-center justify-center">
                <span className="material-symbols-outlined text-5xl text-primary/30 group-hover:scale-110 transition-transform duration-300">
                  storefront
                </span>
                <span className={`absolute top-3 right-3 inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                  business.is_open 
                    ? 'bg-primary text-on-primary shadow-sm' 
                    : 'bg-surface-container-highest text-on-surface-variant'
                }`}>
                  {business.is_open && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>}
                  {business.is_open ? 'Open' : 'Closed'}
                </span>
              </div>
              
              <div className="p-4 flex flex-col gap-2.5 flex-1">
                <div>
                  <h3 className="font-semibold text-base text-on-surface group-hover:text-primary transition-colors line-clamp-1">
                    {business.name}
                  </h3>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {business.category} • {business.distance_km.toFixed(1)} km away
                  </p>
                </div>
                
                {business.address && (
                  <div className="mt-auto pt-2 border-t border-outline-variant/20 flex items-start gap-1.5 text-xs text-on-surface-variant">
                    <span className="material-symbols-outlined text-primary text-base shrink-0">location_on</span>
                    <span className="line-clamp-1">{business.address}</span>
                  </div>
                )}
              </div>
            </Link>
          ))}
      </div>

      {/* FAB - Add Business */}
      <button
        type="button"
        onClick={() => router.push('/business/new')}
        className={`fixed ${embedded ? 'bottom-20 md:bottom-6' : 'bottom-6'} right-5 sm:right-8 w-13 h-13 sm:w-14 sm:h-14 bg-primary text-on-primary rounded-full flex items-center justify-center shadow-xl z-40 hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 touch-target`}
        aria-label="Add new business"
      >
        <span className="material-symbols-outlined text-2xl">add</span>
      </button>
    </div>
  )

  if (embedded) {
    return <div className="w-full flex flex-col">{mainContent}</div>
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-on-surface">
      <header className="bg-surface/95 flex items-center justify-between px-4 sm:px-6 h-14 sm:h-16 w-full sticky top-0 z-40 backdrop-blur-sm border-b border-outline-variant/30 md:hidden">
        <h1 className="font-semibold text-base sm:text-lg text-on-surface">Local Businesses</h1>
      </header>

      <main className="flex-1 px-4 sm:px-6 pb-24 md:pb-8 max-w-7xl mx-auto w-full flex flex-col">
        {mainContent}
      </main>
    </div>
  )
}
