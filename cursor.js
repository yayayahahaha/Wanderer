// 導入必要的 Node.js 模組
import { exec } from 'child_process';
import { promisify } from 'util';

// 將 exec 轉換為 Promise 形式以支持 async/await
const execAsync = promisify(exec);

// Pixiv 的 cookie 認證信息
const cookie = 'privacy_policy_notification=0; a_type=0; b_type=1; first_visit_datetime_pc=2024-05-18%2023%3A54%3A37; yuid_b=FSaXgkA; p_ab_id=2; p_ab_id_2=1; p_ab_d_id=479790549; PHPSESSID=17855562_TC1RRXiojg2ahaKfs5d0feFDaV3nnZFn; privacy_policy_agreement=7; c_type=32; _ga_MZ1NL4PHH0=GS1.1.1739295369.6.0.1739295371.0.0.0; _gcl_au=1.1.1213165398.1739901302; __cf_bm=i6rmBC_kiJux03Y9VQBcNXtKpHP8UUwnAOD06DOcYxI-1743697043-1.0.1.1-CYwHmQUbKIt96Kt5aAMx1cTxRHzJMI6sT7_psH7nKOSLAbCSkLsN1YbKnBJ0xSOeuZ7I_CaEq04dWAn2.tYxKXizHj21LATo2NVVkUIR3tfF.6CbIM8BJ_3Gd0YgUcNy; _ga=GA1.1.803188130.1692017909; cf_clearance=Cy5htY9Zq_vwZqpw1dI2r.seRG0UnDcoGT.YGXGNoRI-1743695135-1.2.1.1-sO0.jG.xdQ1_qB88lJgt0W1OYCo3Mw_G4N6bcaxDNv7HuKN5Lzeto3sV2jke7yQ6BkfN5yoizKW37MK28hwusZuGR0Afocwn6duq7krANH2RO1lSKT.rsUrd8DX0257u7Olt6NKE3KiMnD9_yaP_L_cAe2VF7jA1aNfR2wtR6MgyxzMT3bTkmCfDqIVOv.S2NXfiI285ZhgS.EoPPBDkbjwTPQVGg5X9lLeeg.2WhA9plUv3UZkNxu0bJDVCxl2fDN9Em21WjCKQZiVVCu_SAhE.5IC5vl7OuVt6z.Dnp4G107kDGTQTFwf4Fjz_JsOU5O6DnIwHpqrphV5DZbAAMXj_I.WNJkQNX_FuWs4YEEo; _ga_75BBYNYN9J=GS1.1.1743695133.127.1.1743695144.0.0.0';

// 默認的 Pixiv 作品 URL
const defaultUrl = 'https://www.pixiv.net/artworks/119953580';

/**
 * 使用 curl 發送 HTTP/2 請求到 Pixiv
 * @param {string} url - 目標 URL，默認為 defaultUrl
 * @returns {Promise<Object>} 包含請求結果的對象
 */
async function fetchWithCurl(url = defaultUrl) {
  console.log('開始請求...');
  
  // 構建 curl 命令，包含必要的 headers
  const command = `curl -v --http2 -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36" -H "Cookie: ${cookie}" "${url}"`;
  
  try {
    // 執行 curl 命令
    const { stdout, stderr } = await execAsync(command);
    
    console.log('請求完成');
    console.log('stderr (包含請求/響應頭):', stderr);
    
    return {
      success: true,
      data: stdout,    // 響應內容
      debug: stderr    // 調試信息
    };
  } catch (error) {
    console.error('請求失敗:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 主函數：執行請求並處理結果
 */
async function main() {
  const result = await fetchWithCurl();
  if (result.success) {
    console.log('\n請求結果：');
    console.log('狀態: 成功');
    // 檢查響應內容中是否包含特定文字
    console.log('找到目標文字:', result.data.includes('佐倉杏子') ? '是' : '否');
  } else {
    console.log('狀態: 失敗');
    console.log('錯誤訊息:', result.error);
  }
  process.exit(0);
}

main();
