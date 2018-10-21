// please make sure your nodejs version is higher than 10.4.0

import axios from 'axios';
import fs from 'fs'
import cheerio from 'cheerio'; //var $ = cheerio.load(res.data);
import _ from 'lodash';
import {
    TaskSystem
} from './flyc-lib/utils/TaskSystem';

var currentSESSID = '35210002_3f5f551db1e08d29d3c4dd07f6469308';

// var keyword = 'kill la kill',
// var keyword = 'darling in the franxx',
var keyword = 'skullgirl',
    page = 1,
    totalPages = null,
    totalCount = null,
    likedLevel = 1000,
    ORIGINAL_RESULT_FILE_NAME = null,
    cacheDirectory = {};

var getSearchHeader = function() {
        return {
            'accept-language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6,zh-CN;q=0.5',
            cookie: `PHPSESSID=${currentSESSID};`
        };
    },
    getSinegleHeader = function(createrID) {
        if (!createrID) {
            console.log('請務必輸入該作者的ID');
            return {};
        }
        return {
            referer: `https://www.pixiv.net/member_illust.php?mode=medium&illust_id=${createrID}`
        };
    },
    getSearchUrl = function(keyword, page) {
        return encodeURI(`https://www.pixiv.net/search.php?word=${keyword}&order=date_d&p=${page}`);
    },
    getCacheFileName = function(keyword = 'pixiv', jsonEnd = false) {
        var base = `${ keyword.replace(/ /g, '_') }`;
        return jsonEnd ? `${ base }.json` : base;
    };

// 檢查cacheDirectory.json 是否存在
if (!fs.existsSync('./cacheDirectory.json')) {
    fs.writeFileSync('cacheDirectory.json', JSON.stringify({}));
} else {
    var contents = fs.readFileSync('./cacheDirectory.json'),
        json = JSON.parse(contents);
    cacheDirectory = json;
}

// 故事從這裡開始
firstSearch(getSearchUrl(keyword, page));

async function firstSearch(url) {
    // 為了避免pixiv 負擔過重
    // 先檢查有沒有快取 && 強制更新
    // 部份更新什麼的再說
    if (cacheDirectory[getCacheFileName(keyword, false)]) {
        console.log('目前的搜尋資訊已有過快取，將使用快取進行解析: ');
        console.log(`快取的值為: ${ getCacheFileName(keyword, false) }`);
        var content = fs.readFileSync(`./cache/${ getCacheFileName(keyword, true) }`),
            allPagesImagesArray = JSON.parse(content);

        // 開始過濾
        formatAllPagesImagesArray(allPagesImagesArray);
        return;
    }

    console.log('');
    console.log(`欲查詢的關鍵字是: ${keyword}`);
    console.log(`實際搜尋的網址: ${url}`);
    console.log('開始搜尋..');

    // 快取檔檔名
    ORIGINAL_RESULT_FILE_NAME = getCacheFileName(keyword, true);

    var [data, error] = await axios({
        method: 'get',
        url: url,
        headers: getSearchHeader()
    }).then(({
        data
    }) => {
        return [data, null];
    }).catch((error) => {
        return [null, error];
    });
    if (error) {
        console.log('發生錯誤了');
        console.log(error.response.statusText);
        return;
    }

    console.log('');
    var $ = cheerio.load(data);

    totalCount = parseInt($('.count-badge').text(), 10);
    totalPages = Math.ceil(totalCount / 40);
    console.log(`搜尋結束, 總筆數有 ${totalCount} 件, 共 ${totalPages} 頁`);
    console.log(`開始從中挑選出愛心數大於 ${likedLevel} 顆的連結..`);

    var taskArray = [];
    for (var i = 0; i < totalPages; i++) {
        taskArray.push(_createReturnFunction(i));
    }

    function _createReturnFunction(number) {
        var url = getSearchUrl(keyword, number);
        return function() {
            return axios({
                method: 'get',
                url: url,
                headers: getSearchHeader()
            }).then(({
                data
            }) => {
                var $ = cheerio.load(data),
                    images = JSON.parse($('#js-mount-point-search-result-list').attr('data-items'));
                return images;
            }).catch((error) => {
                return error;
            });
        }
    }

    var task_search = new TaskSystem(taskArray, [], 16);
    var allPagesImagesArray = await task_search.doPromise();
    console.log(`產生的快取檔案為: /cache/${ ORIGINAL_RESULT_FILE_NAME }`);
    fs.writeFileSync(`./cache/${ ORIGINAL_RESULT_FILE_NAME }`, JSON.stringify(allPagesImagesArray));

    console.log('將快取資訊寫入cacheDirectory.json');
    cacheDirectory[getCacheFileName(keyword, false)] = true;
    fs.writeFileSync(`./cacheDirectory.json`, JSON.stringify(cacheDirectory));

    // 開始過濾
    formatAllPagesImagesArray(allPagesImagesArray);

    return;
    // 用來測試實際取到的結果
    fs.writeFileSync('result', data);
}

function formatAllPagesImagesArray(allPagesImagesArray) {
    // 過濾掉失敗的頁數和動圖
    allPagesImagesArray = allPagesImagesArray.filter((imageObject, index) => {
        return !!imageObject.status; // 暫時不處理失敗的部分
    }).map((imageObject) => {
        return imageObject.data.filter((image) => {
            return parseInt(image.illustType, 10) !== 2; // 目前無法解析動圖
        });
    });
    // 但不知道為什麼總數量比頁面上顯示的要少?

    // 壓平所有頁數到同一個陣列
    // 且，過濾掉因為頁數邊界可能造成的重複資料
    var allImagesArray = _.chain(allPagesImagesArray)
        .flattenDepth(1)
        .uniqBy('illustId')
        .sort((a, b) => {
            return a['bookmarkCount'].toString().localeCompare(b['bookmarkCount'].toString()) ||
                a['userId'].toString().localeCompare(b['userId'].toString()) ||
                a['illustId'].toString().localeCompare(b['illustId'].toString());
        })
        .value(),
        authorsObject = _.keyBy(allImagesArray, 'userId');

    console.log(`images Number: ${ allImagesArray.length }`);
    console.log(`author Number: ${ Object.keys(authorsObject).length }`);
    fs.writeFileSync('result.json', JSON.stringify(authorsObject));
}

// TODO:
// 透過搜尋的關鍵字的總total 決定爬幾頁後爬完
// 且，透過標籤上的愛心數決定哪些才要爬

// 爬完之後，將要爬的id 依照作者分類
// 這時就可以產生出作者對id 的單一key 了
// 用來做快速比對的時候很好用
// 接著再分成圖堆和單一圖片

// 作者創資料夾
// 圖堆創資料夾
// 單圖也放在集中的資料夾

// 不過這樣無法逐一檢視
// 所以可能在整個掃完後再特別產一個列表處理這樣u