const headers = [
  {
    name: 'accept',
    value: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9'
  },
  {
    name: 'accept-encoding',
    value: 'gzip, deflate, br'
  },
  {
    name: 'accept-language',
    value: 'zh-TW,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6,ja;q=0.5'
  },
  {
    name: 'cache-control',
    value: 'no-cache'
  },
  {
    name: 'pragma',
    value: 'no-cache'
  },
  {
    name: 'sec-ch-ua',
    value: '"Chromium";v="92", " Not A;Brand";v="99", "Microsoft Edge";v="92"'
  },
  {
    name: 'sec-ch-ua-mobile',
    value: '?0'
  },
  {
    name: 'sec-fetch-dest',
    value: 'document'
  },
  {
    name: 'sec-fetch-mode',
    value: 'navigate'
  },
  {
    name: 'sec-fetch-site',
    value: 'same-origin'
  },
  {
    name: 'sec-fetch-user',
    value: '?1'
  },
  {
    name: 'upgrade-insecure-requests',
    value: '1'
  },
  {
    name: 'user-agent',
    value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36 Edg/92.0.902.67'
  },
  {
    name: 'cookie',
    value: 'first_visit_datetime_pc=2021-08-05+01%3A47%3A26; p_ab_id=6; p_ab_id_2=9; p_ab_d_id=227440680; yuid_b=NVVEZUc; _gcl_au=1.1.35434036.1628095649; _ga=GA1.2.143033748.1628095655; device_token=47dc64cca2e881b06e8a4fd69647c5a1; privacy_policy_agreement=3; c_type=28; privacy_policy_notification=0; a_type=0; b_type=1; PHPSESSID=17855562_xZQfIevwC7XzWBZlCquoVksp9VqYyAC5; tag_view_ranking=qVYWGmmSjN~RYQnOUEjiM~ehwH_2D5wH~KMpT0re7Sq~alCVW0Y-cM~E-Aq3m_zoc~McE_R62H3X~ra__I_4n1i~dBhq3384HI~RTJMXD26Ak~LJo91uBPz4~EvP-chnyjU~QliAD3l3jr~jT6qMyoHEQ~hhMc7AOLaj~o7hvUrSGDN~Lt-oEicbBr; __cf_bm=b5226f6feafe30ec7bbe8d1d4aeb054463cbed50-1628676456-1800-AVGJDSB12eICkltNOQtFQy6TWqcNOl8X4hwXtBYLCmsN+Q5ako2751oLK8OF6Vy/ytrqvUINg10RqE68fyQs7PRj1mFuNp07BQt1vrRZ56+7fIZPt+GrQJLlLmZXGqSOioxVeohSejkqjc7F+2bb1ZLoua6tgqOe6is0aiQLgwkCAJjEDvbCDRwA89rZa5ZMiQ=='
  },
  {
    name: 'referer',
    value: 'https://www.pixiv.net/'
  }
].reduce(
  (map, item) =>
    Object.assign(map, {
      [item.name]: item.value
    }),
  {}
)

module.exports = {
  headers
}
