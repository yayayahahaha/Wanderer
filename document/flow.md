# 主流程

> 因為如果請求次數過多的話會被阻擋，故拉取所有資料後再排序的方式已不適用

### 步驟

1. 使用者輸入關鍵字
2. 用關鍵字透過 [`熱門推薦-api`](#api-get-popular-piece) 找到 `popular` 的 `id`
3. 取出 `permanent` 和 `recent` 裡的**全部 `popular-id`**
4. 用取到的 `popular-id` 透過 [`關聯推薦-api`](#api-get-recommend) 取得各種關聯推薦的 `recommend-id`, 並將其合併到 `popular-id` 並做去重
5. 循環步驟 3 直到 `popular-id` 達到若干數量
6. 開始分批 or 直接全部帶入 [`批量查找圖片基本資訊-api`](#api-get-illus-basic-info-batch) 找出每個圖片的預設資訊
7. 開始用 [`取得詳細資料-api`](#api-get-photo-detail) 獲取相關資訊，取得後**放入快取**

> 待補

### 注意與提醒事項

在取得詳細資料前要和 cache 透過 `updateDate` 這個資訊做比對，再根據 `uploadDate` 去決定要不要重載圖片  
如果有更新的話才去重拉  
而且還要保留原本的資料、做成有 history 那種的

>

### 相關測試案例

有 `token` 下的查詢筆數: `safe` 的有 420 筆  
沒 `token` 下的查詢筆數: `safe/all` 的有 373 筆

中間的差異是每個 `illus` 基本資料裡的 `sl` 造成的:  
**`sl` >= 4 會被判定成敏感資料、所以沒登入的話會查不到**

推測的程度分類:

| Parameter   | Type                             | Description                                                                                          |
| ----------- | -------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `xRestrict` | \{`1`, `0`\}                     | `1` 的話就代表是 `R18` 了                                                                            |
| `sl`        | \{`1`, `2`, `3`, `4`, `5`, `6`\} | 不確定還有沒有漏， `sl` >= 4 的話就會被判斷是敏感、沒登入就不能看了。 `R18` 都是 `6`, 稍微裸露是 `4` |

# API

### <a name="api-get-popular-piece">`getPopularPiece`</a>

**URL** `https://www.pixiv.net/ajax/search/top/{keyword}`  
**Method** `GET`  
**Parameter**

| Key       | Type   |
| --------- | ------ |
| `keyword` | String |

**Query** `N/A`

**Response**

```javascript
{
  body: {
    // ...
    popular: [{
      permanent: [{
        // main
        id: String,
        illustType: Number,
        sl: Number,
        tags: [String],
        title: String,
        updateDate: String,
        userId: String,
        userName: String,
        xRestrict: Number,
        pageCount: Number,

        // others
        alt: String,
        bookmarkData: null, // 尚不確定
        createDate: String,
        description: String,
        height: Number,
        isBookmarkable: Boolean,
        isMasked: Boolean,
        isUnlisted: Boolean,
        profileImageUrl: String,
        restrict: Number,
        titleCaptionTranslation: { workTitle: null, workCaption: null }, // 尚不確定
        url: String,
        width: Number,
      }],
      recent: [/* same as permanent */]
    }],
    // ...
  },
  error: Boolean
}
```

---

### <a name="api-get-recommend">`getRecommend`</a>

**URL** `https://www.pixiv.net/ajax/illust/{illust-id}/recommend/init`  
**Method** `GET`  
**Parameter**

| Key        | Type   |
| ---------- | ------ |
| `illus-id` | String |

**Query**

| Key     | Type         | Default | Description          |
| ------- | ------------ | ------- | -------------------- |
| `limit` | StringNumber | 20      | 還沒測試上限         |
| `lang`  | String       | zh_tw   | 還沒測試是否會有影響 |

**Response**

```javascript
// 要取得的 id: details 的 keys, illusts 的 id 還有 nextIds 的全部
// 其中 illusts 的部分已經有基本的圖片資訊了
{
  body: {
    // 不太確定這邊的 detail 是要做什麼的? 不過還是有取得那些 id 的價值
    details: {
      ['illus-id']: {
        banditInfo: String,
        methods: ['recommendation_by_illust_tag'/* 在這個行為裡面應該是寫死的? */],
        recommendListId: String, // 應該代表這個 list 的 primary key?
        score: Number, // 會是一個如 0.010344422422349453 的 float 字串，應該是關聯度分數
        seedIllustIds: [String] // 放的是用於這個 recommend 的 illus-id
      }
    },
    // 這個是如果點擊了 like 的話會跳出來的 '你可能也會喜歡' 的那行
    illusts: [{
      // main
      id: String,
      illustType: Number,
      sl: Number,
      tags: [String],
      title: String,
      updateDate: String,
      userId: String,
      userName: String,
      xRestrict: Number,
      pageCount: Number,

      // others
      alt: String,
      bookmarkData: null, // 還不確定
      createDate: String,
      description: String,
      height: Number,
      isBookmarkable: Boolean,
      isMasked: Boolean,
      isUnlisted: Boolean,
      profileImageUrl: String,
      restrict: Number,
      titleCaptionTranslation: { workTitle: null, workCaption: null }, // 還不確定
      type: String, // 相較 popularPiece api 多了這個. 例子是 'illust', 所以應該還有 novel, manga 等?
      url: String,
      width: Number,
    }],
    // 這個是其他會隨著 lazy-loading 載入的其他推薦, 都只有 illus-id
    nextIds: [String]
  },
  error: Boolean,
  message: String
}
```

---

### <a name="api-get-illus-basic-info-batch">`getIllusBasicInfoBatch`</a>

**URL** `https://www.pixiv.net/ajax/illust/recommend/illusts`  
**Method** `GET`  
**Parameter** `N/A`  
**Query**

| Key            | Type                | Description                                       |
| -------------- | ------------------- | ------------------------------------------------- |
| `illust_ids[]` | String (`illus-id`) | 是透過 array 的方式傳過去的，很神奇，尚未實際測試 |

**Response**

```javascript
{
  body: {
    illusts: [{
      // 和 recommend 取到的結構是一樣的

      // main
      id: String,
      illustType: Number,
      sl: Number,
      tags: [String],
      title: String,
      updateDate: String,
      userId: String,
      userName: String,
      xRestrict: Number,
      pageCount: Number,

      // others
      alt: String,
      bookmarkData: null, // 還不確定
      createDate: String,
      description: String,
      height: Number,
      isBookmarkable: Boolean,
      isMasked: Boolean,
      isUnlisted: Boolean,
      profileImageUrl: String,
      restrict: Number,
      titleCaptionTranslation: { workTitle: null, workCaption: null }, // 還不確定
      type: String,
      url: String,
      width: Number,
    }]
  },
  error: Boolean,
  message: String
}
```

---

### <a name="api-get-photo-detail">getPhotoDetail</a>

**URL** `https://www.pixiv.net/ajax/illust/${artWorkId}`  
**Method** `GET`  
**Parameter**

| Key         | Type                       | Description |
| ----------- | -------------------------- | ----------- |
| `artWorkId` | String (`any-art-work-id`) |

**Query**

| Key    | Type           | Description                            |
| ------ | -------------- | -------------------------------------- |
| `ref`  | String (`url`) | 看起來就是 `https://www.pixiv.net/`    |
| `lang` | String         | 測資為 `zh_tw`, 還沒測試有沒有其他影響 |

**Response**

```javascript
{
  body: {
    // main
    id: String,
    illustId: String, // same as id
    title: String,
    illustTitle: String,
    xRestrict: Number,
    sl: Number,
    urls: {
      mini: String,
      thumb: String,
      small: String,
      regular: String,
      original: String // this one
    },
    tags: {
      authorId: String,
      isLocked: Boolean,
      tags: [{
        tag: String,
        locked: Boolean,
        deletable: Boolean,
        userId: String,
        translation: { ['locale-code']: String },
        userName: String
      }],
      writable: Boolean
    },
    pageCount: Number,
    bookmarkCount: Number, // add bookmarkCount and likeCount both
    likeCount: Number, // add bookmarkCount and likeCount both
    uploadDate: String, // 和 updateTime 某些意義上不一樣，但這個更新了的話，上層的 uploadDate 應該也會更新才對

    // others
    illustComment: String,
    description: String,
    illustType: Number,
    createDate: String,
    restrict: Number,
    alt: String,
    storableTags: [String],
    userId: String,
    userName: String,
    userAccount: String,
    userIllusts: {
      ['illus-id']: {
        id: String,
        title: String,
        illustType: Number,
        xRestrict: Number,
        restrict: Number,
        sl: Number,
        url: String,
        description: String,
        tags: [String],
        userId: String,
        userName: String,
        width: Number,
        height: Number,
        pageCount: Number,
        isBookmarkable: Boolean,
        bookmarkData: null,
        alt: String,
        titleCaptionTranslation: { workTitle: null, workCaption: null },
        createDate: String,
        updateDate: String,
        isUnlisted: Boolean,
        isMasked: Boolean,
        profileImageUrl: String
      },
    },
    width: Number,
    height: Number,
    likeData: Boolean,
    commentCount: Number,
    responseCount: Number,
    viewCount: Number,
    bookStyle: String,
    isHowto: Boolean,
    isOriginal: Boolean,
    imageResponseOutData: [],
    imageResponseData: [],
    imageResponseCount: Number,
    pollData: null,
    seriesNavData: null,
    descriptionBoothId: null,
    descriptionYoutubeId: null,
    comicPromotion: null,
    fanboxPromotion: null,
    contestBanners: [],
    isBookmarkable: Boolean,
    bookmarkData: null,
    contestData: null,
    zoneConfig: {
      responsive: { url: String },
      rectangle: { url: String },
      '500x500': { url: String },
      header: { url: String },
      footer: { url: String },
      expandedFooter: { url: String },
      logo: { url: String },
      relatedworks: { url: String }
    },
    extraData: {
      meta: {
        title: String,
        description: String,
        canonical: String,
        alternateLanguages: {
          ja: String,
          en: String
        },
        descriptionHeader: String,
        ogp: {
          description: String,
          image: String,
          title: String,
          type: String
        },
        twitter: {
          description: String,
          image: String,
          title: String,
          card: String
        }
      }
    },
    titleCaptionTranslation: {
      workTitle: null,
      workCaption: null
    },
    isUnlisted: Boolean,
    request: null,
    commentOff: Number
  }
  error: Boolean,
  message: String
}
```
