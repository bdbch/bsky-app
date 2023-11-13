import React from 'react'
import {
  useQuery,
  useInfiniteQuery,
  InfiniteData,
  QueryKey,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import {
  AtUri,
  RichText,
  AppBskyFeedDefs,
  AppBskyGraphDefs,
  AppBskyUnspeccedGetPopularFeedGenerators,
} from '@atproto/api'

import {router} from '#/routes'
import {sanitizeDisplayName} from '#/lib/strings/display-names'
import {sanitizeHandle} from '#/lib/strings/handles'
import {useSession} from '#/state/session'
import {usePreferencesQuery} from '#/state/queries/preferences'

export type FeedSourceInfo =
  | {
      type: 'feed'
      uri: string
      route: {
        href: string
        name: string
        params: Record<string, string>
      }
      cid: string
      avatar: string | undefined
      displayName: string
      description: RichText
      creatorDid: string
      creatorHandle: string
      likeCount: number | undefined
      likeUri: string | undefined
    }
  | {
      type: 'list'
      uri: string
      route: {
        href: string
        name: string
        params: Record<string, string>
      }
      cid: string
      avatar: string | undefined
      displayName: string
      description: RichText
      creatorDid: string
      creatorHandle: string
    }

export const feedSourceInfoQueryKey = ({uri}: {uri: string}) => [
  'getFeedSourceInfo',
  uri,
]

const feedSourceNSIDs = {
  feed: 'app.bsky.feed.generator',
  list: 'app.bsky.graph.list',
}

export function hydrateFeedGenerator(
  view: AppBskyFeedDefs.GeneratorView,
): FeedSourceInfo {
  const urip = new AtUri(view.uri)
  const collection =
    urip.collection === 'app.bsky.feed.generator' ? 'feed' : 'lists'
  const href = `/profile/${urip.hostname}/${collection}/${urip.rkey}`
  const route = router.matchPath(href)

  return {
    type: 'feed',
    uri: view.uri,
    cid: view.cid,
    route: {
      href,
      name: route[0],
      params: route[1],
    },
    avatar: view.avatar,
    displayName: view.displayName
      ? sanitizeDisplayName(view.displayName)
      : `Feed by ${sanitizeHandle(view.creator.handle, '@')}`,
    description: new RichText({
      text: view.description || '',
      facets: (view.descriptionFacets || [])?.slice(),
    }),
    creatorDid: view.creator.did,
    creatorHandle: view.creator.handle,
    likeCount: view.likeCount,
    likeUri: view.viewer?.like,
  }
}

export function hydrateList(view: AppBskyGraphDefs.ListView): FeedSourceInfo {
  const urip = new AtUri(view.uri)
  const collection =
    urip.collection === 'app.bsky.feed.generator' ? 'feed' : 'lists'
  const href = `/profile/${urip.hostname}/${collection}/${urip.rkey}`
  const route = router.matchPath(href)

  return {
    type: 'list',
    uri: view.uri,
    route: {
      href,
      name: route[0],
      params: route[1],
    },
    cid: view.cid,
    avatar: view.avatar,
    description: new RichText({
      text: view.description || '',
      facets: (view.descriptionFacets || [])?.slice(),
    }),
    creatorDid: view.creator.did,
    creatorHandle: view.creator.handle,
    displayName: view.name
      ? sanitizeDisplayName(view.name)
      : `User List by ${sanitizeHandle(view.creator.handle, '@')}`,
  }
}

export function getFeedTypeFromUri(uri: string) {
  const {pathname} = new AtUri(uri)
  return pathname.includes(feedSourceNSIDs.feed) ? 'feed' : 'list'
}

export function useFeedSourceInfoQuery({uri}: {uri: string}) {
  const {agent} = useSession()
  const type = getFeedTypeFromUri(uri)

  return useQuery({
    queryKey: feedSourceInfoQueryKey({uri}),
    queryFn: async () => {
      let view: FeedSourceInfo

      if (type === 'feed') {
        const res = await agent.app.bsky.feed.getFeedGenerator({feed: uri})
        view = hydrateFeedGenerator(res.data.view)
      } else {
        const res = await agent.app.bsky.graph.getList({
          list: uri,
          limit: 1,
        })
        view = hydrateList(res.data.list)
      }

      return view
    },
  })
}

export const useGetPopularFeedsQueryKey = ['getPopularFeeds']

export function useGetPopularFeedsQuery() {
  const {agent} = useSession()

  return useInfiniteQuery<
    AppBskyUnspeccedGetPopularFeedGenerators.OutputSchema,
    Error,
    InfiniteData<AppBskyUnspeccedGetPopularFeedGenerators.OutputSchema>,
    QueryKey,
    string | undefined
  >({
    queryKey: useGetPopularFeedsQueryKey,
    queryFn: async ({pageParam}) => {
      const res = await agent.app.bsky.unspecced.getPopularFeedGenerators({
        limit: 10,
        cursor: pageParam,
      })
      return res.data
    },
    initialPageParam: undefined,
    getNextPageParam: lastPage => lastPage.cursor,
  })
}

export function useSearchPopularFeedsMutation() {
  const {agent} = useSession()

  return useMutation({
    mutationFn: async (query: string) => {
      const res = await agent.app.bsky.unspecced.getPopularFeedGenerators({
        limit: 10,
        query: query,
      })

      return res.data.feeds
    },
  })
}

const FOLLOWING_FEED_STUB: FeedSourceInfo = {
  type: 'feed',
  displayName: 'Following',
  uri: '',
  route: {
    href: '/',
    name: 'Home',
    params: {},
  },
  cid: '',
  avatar: '',
  description: new RichText({text: ''}),
  creatorDid: '',
  creatorHandle: '',
  likeCount: 0,
  likeUri: '',
}

export function usePinnedFeedsInfos(): FeedSourceInfo[] {
  const {agent} = useSession()
  const queryClient = useQueryClient()
  const [tabs, setTabs] = React.useState<FeedSourceInfo[]>([
    FOLLOWING_FEED_STUB,
  ])
  const {data: preferences} = usePreferencesQuery()
  const pinnedFeedsKey = JSON.stringify(preferences?.feeds?.pinned)

  React.useEffect(() => {
    if (!preferences?.feeds?.pinned) return
    const uris = preferences.feeds.pinned

    async function fetchFeedInfo() {
      const reqs = []

      for (const uri of uris) {
        const cached = queryClient.getQueryData<FeedSourceInfo>(
          feedSourceInfoQueryKey({uri}),
        )

        if (cached) {
          reqs.push(cached)
        } else {
          reqs.push(
            queryClient.fetchQuery({
              queryKey: feedSourceInfoQueryKey({uri}),
              queryFn: async () => {
                const type = getFeedTypeFromUri(uri)

                if (type === 'feed') {
                  const res = await agent.app.bsky.feed.getFeedGenerator({
                    feed: uri,
                  })
                  return hydrateFeedGenerator(res.data.view)
                } else {
                  const res = await agent.app.bsky.graph.getList({
                    list: uri,
                    limit: 1,
                  })
                  return hydrateList(res.data.list)
                }
              },
            }),
          )
        }
      }

      const views = await Promise.all(reqs)

      setTabs([FOLLOWING_FEED_STUB].concat(views))
    }

    fetchFeedInfo()
  }, [
    agent,
    queryClient,
    setTabs,
    preferences?.feeds?.pinned,
    // ensure we react to re-ordering
    pinnedFeedsKey,
  ])

  return tabs
}