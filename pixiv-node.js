import http2 from 'http2';
import tls from 'tls';

// 請從瀏覽器複製新的 cookie 值替換這裡
const cookie = 'privacy_policy_notification=0; a_type=0; b_type=1; first_visit_datetime_pc=2024-05-18%2023%3A54%3A37; yuid_b=FSaXgkA; p_ab_id=2; p_ab_id_2=1; p_ab_d_id=479790549; PHPSESSID=17855562_TC1RRXiojg2ahaKfs5d0feFDaV3nnZFn; privacy_policy_agreement=7; c_type=32; _ga_MZ1NL4PHH0=GS1.1.1739295369.6.0.1739295371.0.0.0; _gcl_au=1.1.1213165398.1739901302; _ga=GA1.1.803188130.1692017909; cf_clearance=Cy5htY9Zq_vwZqpw1dI2r.seRG0UnDcoGT.YGXGNoRI-1743695135-1.2.1.1-sO0.jG.xdQ1_qB88lJgt0W1OYCo3Mw_G4N6bcaxDNv7HuKN5Lzeto3sV2jke7yQ6BkfN5yoizKW37MK28hwusZuGR0Afocwn6duq7krANH2RO1lSKT.rsUrd8DX0257u7Olt6NKE3KiMnD9_yaP_L_cAe2VF7jA1aNfR2wtR6MgyxzMT3bTkmCfDqIVOv.S2NXfiI285ZhgS.EoPPBDkbjwTPQVGg5X9lLeeg.2WhA9plUv3UZkNxu0bJDVCxl2fDN9Em21WjCKQZiVVCu_SAhE.5IC5vl7OuVt6z.Dnp4G107kDGTQTFwf4Fjz_JsOU5O6DnIwHpqrphV5DZbAAMXj_I.WNJkQNX_FuWs4YEEo; _ga_75BBYNYN9J=GS1.1.1743695133.127.1.1743695158.0.0.0; __cf_bm=s2Rq_r0dYaEY_Yg2nDJaFutyIYcWiQA2Fc9dmpnBmgM-1743697018-1.0.1.1-icPeM.XNpNW8NFjKkjoEr9IKh3ScXTq_gxiorPdKbS7dX.L5Ja8JGcl9GYUiBoEnikCrztcxYymQdhjTPJzeIWvqkLqDAdi3RQYl7w0.66D6RGxs0z2AXY3ZDq1IXa6G';
const defaultUrl = 'https://www.pixiv.net/artworks/119953580';

// HTTP2 請求配置
const requestHeaders = {
  ':method': 'GET',
  ':scheme': 'https', 
  ':authority': 'www.pixiv.net',
  'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'accept-encoding': 'gzip, deflate, br',
  'accept-language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
  'cache-control': 'no-cache',
  'pragma': 'no-cache',
  'priority': 'u=0, i',
  'sec-ch-ua': '"Chromium";v="134", "Not:A-Brand";v="24", "Google Chrome";v="134"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"macOS"',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate', 
  'sec-fetch-site': 'same-origin',
  'sec-fetch-user': '?1',
  'upgrade-insecure-requests': '1',
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
  'cookie': cookie,
  'referer': 'https://www.pixiv.net/',
  'referrer-policy': 'strict-origin-when-cross-origin'
};

async function fetchWithHttp2(url = defaultUrl, retries = 3) {
  console.log('開始請求...');
  console.log('目標 URL:', url);
  console.log('剩餘重試次數:', retries);

  return new Promise((resolve, reject) => {
    // 建立 HTTP2 連接
    const client = http2.connect('https://www.pixiv.net', {
      protocol: 'https:',
      servername: 'www.pixiv.net',
      rejectUnauthorized: true,
      ca: tls.rootCertificates
    });

    // 錯誤處理與重試邏輯
    const handleError = (err, source) => {
      console.error(`${source}錯誤:`, err);
      console.error('錯誤堆疊:', err.stack);
      client.close();
      
      if (retries > 0) {
        console.log('重試中...');
        setTimeout(() => {
          fetchWithHttp2(url, retries - 1)
            .then(resolve)
            .catch(reject);
        }, 1000);
      } else {
        reject(err);
      }
    };

    client.on('error', (err) => handleError(err, '客戶端'));

    // 連接成功時的處理
    client.on('connect', () => {
      console.log('TLS 連接已建立');
      console.log('協議版本:', client.socket.getProtocol());
      console.log('加密套件:', client.socket.getCipher());
      console.log('遠程地址:', client.socket.remoteAddress);
      console.log('本地地址:', client.socket.localAddress);
    });

    // 發送請求
    const req = client.request({
      ...requestHeaders,
      ':path': new URL(url).pathname
    });

    let data = '';
    let headers = null;

    req.on('response', (responseHeaders) => {
      headers = responseHeaders;
      console.log('響應狀態碼:', responseHeaders[':status']);
      console.log('響應頭:', responseHeaders);
    });

    req.on('data', (chunk) => {
      data += chunk;
    });

    req.on('end', () => {
      console.log('請求完成');
      client.close();
      resolve({
        success: true,
        data,
        headers
      });
    });

    req.on('error', (err) => handleError(err, '請求'));
    req.end();
  });
}

async function main() {
  try {
    const result = await fetchWithHttp2();
    if (result.success) {
      console.log('\n請求結果：');
      console.log('狀態: 成功');
      console.log('找到目標文字:', result.data.includes('佐倉杏子') ? '是' : '否');
    }
  } catch (error) {
    console.log('狀態: 失敗');
    console.log('錯誤訊息:', error);
    console.log('錯誤堆疊:', error.stack);
  }
  process.exit(0);
}

main();