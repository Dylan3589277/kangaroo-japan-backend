<?php

namespace app\common\library;

use app\common\model\YahooGoods;
use think\Db;
use think\helper\Str;
use Tools\StRedis;
use voku\helper\HtmlDomParser;

/**
 * Created by PhpStorm.
 * Date: 2021/8/22
 * Time: 16:48
 * description:
 * https://www.mercari.com/jp/category/1/
 */
class Yahoo
{

    private $proxy = [
        'host' => '127.0.0.1',
        'port' => '7890'
    ];

    /**
     * 同步分类
     */
    public function cats()
    {
//        $url = 'https://www.mercari.com/jp/';
//        $content = $this->doGet($url);
        $content = '';
        $html = HtmlDomParser::str_get_html($content);
        $uls = $html->find('ul');
        foreach ($uls as $ul) {
            $this->parseCats($ul);
        }
    }

    public function sortArr()
    {
        $sortArr = [
            ['name' => '推荐排序', 's1' => 'score2', 'o1' => 'd'],
            ['name' => '新到货订单', 's1' => 'new', 'o1' => 'd'],
            ['name' => '按现价升序排列', 's1' => 'cbids', 'o1' => 'a'],
            ['name' => '当前最高价', 's1' => 'cbids', 'o1' => 'd'],
            ['name' => '按出价数量降序排列', 's1' => 'bids', 'o1' => 'a'],
            ['name' => '按出价升序排列', 's1' => 'bids', 'o1' => 'd'],
            ['name' => '按剩余时间升序', 's1' => 'end', 'o1' => 'a'],
            ['name' => '最长剩余时间', 's1' => 'end', 'o1' => 'd'],
            ['name' => '升序提示决策价', 's1' => 'bidorbuy', 'o1' => 'a'],
            ['name' => '降序提示决策价格', 's1' => 'bidorbuy', 'o1' => 'd'],
            ['name' => '精选拍卖订单', 's1' => 'feature', 'o1' => 'd']
        ];
        return $sortArr;
    }

    /**
     * 搜索商品
     */
    public function searchGoods($start = 1, $auccat = '', $keyword = '', $pageSize = 50, $s1 = '', $o1 = '', $thumb = 1)
    {

        $where = [
            'auccat' => $auccat,
            'thumb' => $thumb,
            'p' => $keyword,
            'exflg' => 1,
            'va' => 1,
            'b' => $start,
            'n' => $pageSize,
            's1' => $s1,
            'o1' => $o1
        ];

        foreach ($where as $key => $value) {
            if (empty($value)) {
                unset($where[$key]);
            }
        }


        try {
            $url = sprintf('https://auctions.yahoo.co.jp/search/search?%s', http_build_query($where));
            $content = $this->doGet($url);
            if (!$content) {
                return false;
            }
            file_put_contents(runtime_path().'yahoo_search.html',$content);
            $html = HtmlDomParser::str_get_html($content);
            $sections = $html->find('ul.Products__items', 0);
            if (!$sections) {
                return false;
            }
            $goodsList = [];
            $lis = $sections->find('li.Product');
            $redis = new StRedis();
            foreach ($lis as $li) {
                $a = $li->find('a', 0);
                if (!$a) {
                    continue;
                }
                $auctionId = $a->getAttribute('data-auction-id');
                $auctionImg = $a->getAttribute('data-auction-img');
                $auctionPrice = $a->getAttribute('data-auction-price');
                $auctionTitle = $a->getAttribute('data-auction-title');
                $fastPrice = 0;
                $priceValue = $li->find('span.Product__priceValue');
                if ($priceValue && count($priceValue) > 1) {
                    $fastPrice = $priceValue[1]->text();
                    $fastPrice = str_replace([',', '円'], '', $fastPrice);
                }
                $bidNum = $li->find('dd.Product__bid', 0)->text();
                $leftTime = $li->find('dd.Product__time', 0)->text();
                $unusedText = '';
                $unusedNode = $li->find('span.Product__icon--unused', 0);
                if ($unusedNode) {
                    $unusedText = $unusedNode->text();
                }
                $freeShip = '';
                $freeShipNode = $li->find('span.Product__icon--freeShipping', 0);
                if ($freeShipNode) {
                    $freeShip = $freeShipNode->text();
                }

                $bonus = $li->find('div.Product__bonus', 0);
                $endTime = $bonus->getAttribute('data-auction-endtime');
                $sellerid = $bonus->getAttribute('data-auction-sellerid');
                $startprice = $bonus->getAttribute('data-auction-startprice');
                $caneasypayment = $bonus->getAttribute('data-auction-caneasypayment');
                $buynowprice = $bonus->getAttribute('data-auction-buynowprice');

                $data = [
                    'goods_name' => $auctionTitle,
                    'cover' => oss_url($auctionImg),
                    'price' => trim($auctionPrice),
                    'goods_no' => trim($auctionId),
                    'fastprice' => $fastPrice,
                    'bid_num' => $bidNum,
                    'end_time' => $endTime,
                    'left_time' => $leftTime,
                    'seller' => $sellerid,
                    'start_price' => $startprice,
                    'buynowprice' => $buynowprice,
                    'unused' => $unusedText,
                    'free_ship' => $freeShip
                ];
                $redis->set('yahoo:goods_list_' . $data['goods_no'], json_encode($data), 3600);

                //list($errcode,$result) = (new YahooGoods())->addRow($data);
                $goodsList[] = $data;
            }

            //-- 获取二级分类
            $catList = [];
            if ($auccat > 0) {
                $filterDivs = $html->find('div.Filter');
                if ($filterDivs && count($filterDivs) > 0) {
                    $links = $filterDivs[1]->find('a.Filter__link');
                    foreach ($links as $link) {
                        $href = $link->getAttribute('href');
                        $result = [];
                        $href = str_replace('&amp;', '&', $href);
                        $urlArr = parse_url(urldecode($href));
                        parse_str($urlArr['query'], $result);
                        if (!isset($result['auccat'])) {
                            continue;
                        }

                        $catList[] = [
                            'name' => $link->text(),
                            'data' => $result['auccat']
                        ];
                    }
                }
            }


            $totalNum = $html->find('span.Tab__subText', 0)->text();
            $totalNum = str_replace(['件', ','], '', $totalNum);

            return compact('goodsList', 'totalNum', 'catList');
        }
        catch (\Exception $e) {
            return false;
        }


    }

    public function parseUrl($url)
    {
        $href = trim($url, '/');
        $hrefArr = explode('/', $href);
        return trim(array_pop($hrefArr));
    }

    /**
     * 获取卖家商品
     * @param $seller
     * @return array|false
     */
    public function getSellerGoods($seller,$kw=''){
        $url = sprintf('https://auctions.yahoo.co.jp/seller/%s?user_type=c',$seller);
        if(!empty($kw)){
            $url .='&p='.$kw;
        }
        try {
            $content = $this->doGet($url);
            if (!$content) {
                return false;
            }
            $html = HtmlDomParser::str_get_html($content);
            $list01 = $html->find('div.Products__list', 0);
            if (!$list01) {
                return false;
            }
            $goodsList = [];
            $lis = $list01->find('li.Product');
            $redis = new StRedis();
            foreach ($lis as $li) {
//                $class = $li->getAttribute('class');
//                if(stripos($class,'cf') === false){
//                    continue;
//                }
                $a = $li->find('a', 0);
                if (!$a) {
                    continue;
                }
                $auctionId = $a->getAttribute('data-auction-id');
                $auctionImg = $a->find('img',0)->getAttribute('src');

                $descDiv = $li->find('div.a',0);
                $auctionPrice = $li->find('dd.Product__priceValue',0)->text();
                $auctionPrice = str_replace([',', '円'], '', $auctionPrice);
                $auctionTitle = $a->find('img',0)->getAttribute("alt");

                $bidNum = $li->find('dd.Product__bid', 0)->text();
                $leftTime = $li->find('dd.Product__time', 0)->text();


                $data = [
                    'goods_name' => $auctionTitle,
                    'cover' => oss_url($auctionImg),
                    'price' => trim($auctionPrice),
                    'goods_no' => trim($auctionId),
                    'fastprice' => 0,
                    'bid_num' => $bidNum,
                    'end_time' => '',
                    'left_time' => $leftTime,
                    'seller' => $seller,
                    'start_price' => '',
                    'buynowprice' => ''
                ];
                $redis->set('yahoo:goods_list_' . $data['goods_no'], json_encode($data), 3600);

                //list($errcode,$result) = (new YahooGoods())->addRow($data);
                $goodsList[] = $data;
            }

            //-- 获取二级分类
            $totalNum = 1;
            $subNode = $html->find('span.Tab__subText', 0);
            if($subNode){
                $totalNum = $subNode->text();
                $totalNum = str_replace(['件', ','], '', $totalNum);
                $totalNum = intval($totalNum);
            }

            return compact('goodsList', 'totalNum');
        }
        catch (\Exception $e) {
            return false;
        }

    }


    public function gooddetail($itemId)
    {
        $url = 'https://auctions.yahoo.co.jp/jp/auction/' . $itemId;
        $content = $this->doGet($url);
        if (!$content) {
            return false;
        }

        file_put_contents(runtime_path().'yahoo_detail.html',$content);
        $html = HtmlDomParser::str_get_html($content);
        try {
            $goodsName = $html->find('div[id=itemTitle]', 0)->text();
            $priceNode = $html->find('span.kxUAXU', 0);

            $priceTxt = $priceNode->text();

            $price = $this->getNumberStr(str_replace([',','円'], '', $priceTxt));
//            $taxTxt = $priceNode->find('span.Price__tax', 0)->text();
//            $tax = $this->getNumberStr($taxTxt);
            $tax = '0';

            $itemStatusNode = $html->find('div[id=itemStatus]',0);
            $itemSpanList = $itemStatusNode->find('span');
            $itemAList = $itemStatusNode->find('a');

            $leftTime  = '';
            $bidNum = '';
            foreach ($itemSpanList as $itemNode){
                $textStr = $itemNode->text();
                if(stripos($textStr,'月') !== false){
                    $leftTime = $textStr;
                }
                if(stripos($textStr,'件') !== false){
                    $bidNum = str_replace('件','',$textStr);
                }

            }

            foreach ($itemAList as $itemNode){
                $textStr = $itemNode->text();
                if(stripos($textStr,'件') !== false){
                    $bidNum = str_replace('件','',$textStr);
                }
            }

            //-- 获取状态
            $productRows = $html->find('tr.ProductTable__row');
            $status = '无';
            if ($productRows && count($productRows) > 0) {
                $lastItem = $productRows[count($productRows) - 1];
                $thTxt = $lastItem->find('th.ProductTable__th', 0)->text();
                if (trim($thTxt) == '状態') {
                    $status = $lastItem->find('a', 0)->text();
                }
            }
            $imgNodes = $html->find('div[id=imageGallery]', 0)->find('img');
            $imgUrls = [];
            foreach ($imgNodes as $img) {
                $imgUrls[] = oss_url($img->getAttribute('src'),1);
            }
            $attrList = [
                [
                    'name' => '商品ID',
                    'value' => $itemId
                ],
                [
                    'name' => '終了日時',
                    'value' => $leftTime
                ]
            ];

            //卖家
            $sellerNode = $html->find('div[id=sellerInfo]',0);

            $sellerA = $sellerNode->find('a', 0);
            $seller = $sellerA->text();
            $sellerHref = $sellerA->getAttribute("href");
            $sellerId = '';
            if(!empty($sellerHref)){
                $sellerHref = explode('?',$sellerHref)[0];
                $urlArr = explode('/',$sellerHref);
                $sellerId = end($urlArr);
            }




            $seller_address = "";

            //-- 获取评价信息
            $rateNum = 0;
            $ratePercent = '0.0%';

            $itemPostage = $html->find("div[id=itemPostage]",0);
            $songliao = "";
            if($itemPostage){
                $songliao = $itemPostage->find("dd",0)->text();
            }

            //商品详细资料
            $itemInfoNode = $html->find('div[id=itemInfo]',0);
            $dtList = $itemInfoNode->find('dt');
            $ddList = $itemInfoNode->find('dd');
            $inArr = [];
            $notAllow = ['入札者認証制限','入札者認証制限','クーポン名'];
            for($i=0;$i<count($dtList);$i++){
                if($i > 10){
                    break;
                }
                $name = $dtList[$i]->text();
                $value = $ddList[$i]->text();
                if (empty($name) || in_array($name,$inArr) || in_array($name,$notAllow)) {
                    continue;
                }

                if($name == "送料"){
                    $value = $songliao;
                }

                $inArr[] = $name;
                $value = str_replace('：', '', $value);
                $attrList[] = [
                    'name' => $name,
                    'value' => trim($value)
                ];

                if($name == '支払い方法'){
                    break;
                }

                if($name == "発送元の地域"){
                    $seller_address = $value;
                }
            }


            $descriptionNode = $html->find('div[id=description]',0);
            if($descriptionNode){
                $content = $descriptionNode->innerHtml();
            }


            //-- 立即购买价格
            $buynowPrice = 0;
            $priceNode = $html->find('span.ktJiuH', 0);
            if($priceNode){
                $buynowPrice = $this->getNumberStr(str_replace([',','円'], '', $priceNode->text()));
            }

            $priceTitle = '';
            $priceTitleDiv = $html->find('dt.Price__title',0);
            if($priceTitleDiv){
                $priceTitle = $priceTitleDiv->text();
            }

            $durl = '';
            $delivery = $html->find('input#js-deliveryData',0);
            if($delivery){
                $durl = $delivery->getAttribute('data-url');
                $eappid = $delivery->getAttribute('data-eappid');
                $prefCode = $delivery->getAttribute('data-prefcode');
                $durl = sprintf("%s?pref_code=%d&eappid=%s&_%d",$durl,trim($prefCode),$eappid,time()*1000);
            }


            //-- 运费
//            $postTxt = $html->find('span.Price__postageValue',0)->text();
            $postTxt = '';

            if(count($imgUrls) > 8){
                $imgUrls = array_slice($imgUrls,0,8);
            }

            $content = str_replace('商品説明','',$content);

            $data = [
                'goods_name' => $goodsName.(trim($priceTitle) == '即決'?'(即決)':''),
                'content' => $content,
                'price' => $tax,
                'bid_num' => $bidNum,
                'left_time' => $leftTime,
                'bid_price' => floatval($price),
                'fastprice' => floatval($buynowPrice),
                'cover' => count($imgUrls) > 0?$imgUrls[0]:'',
                'goods_no' => $itemId,
                'postTxt' => $postTxt,
                'durl' => $durl,
                'status' => trim($status),
                'extras' => json_encode($attrList, JSON_UNESCAPED_UNICODE),
                'imgurls' => json_encode($imgUrls),
                'seller' => $seller,
                'seller_id' => $sellerId,
                'rate_num' => $rateNum,
                'rate_percent' => $ratePercent,
                'seller_address' => $seller_address,
                'price_title' => trim($priceTitle)
            ];

            if($data['price_title'] == '即決' && $data['fastprice'] <=0){
                $data['fastprice'] = $data['bid_price'];
            }

            list($errcode, $result) = (new YahooGoods())->addRow($data);
            return $data;

        }
        catch (\Exception $e) {
            return $e->getMessage().$e->getLine();
        }
    }

    /**
     * 商品详情
     * @param $itemId
     * @return array|bool
     */
    public function gooddetail2($itemId)
    {
        $url = 'https://page.auctions.yahoo.co.jp/jp/auction/' . $itemId;
        $content = $this->doGet($url);
        if (!$content) {
            return false;
        }
   
        file_put_contents(runtime_path().'yahoo_detail.html',$content);
        $html = HtmlDomParser::str_get_html($content);
        try {
            $goodsName = $html->find('h1.ProductTitle__text', 0)->text();
            $bidNum = $html->find('span.Count__detail', 0)->text();
            $bidNum = $this->getNumberStr($bidNum);
            $leftTime = $html->find('span.Count__endDate', 0)->text();
            $leftTime = str_replace(['詳細'], '', $leftTime);
            $priceNode = $html->find('dd.Price__value', 0);
            $priceTxt = $priceNode->text();
            $taxTxt = $priceNode->find('span.Price__tax', 0)->text();
            $price = $this->getNumberStr(str_replace($taxTxt, '', $priceTxt));
            $tax = $this->getNumberStr($taxTxt);
            //-- 获取状态
            $productRows = $html->find('tr.ProductTable__row');
            $status = '无';
            if ($productRows && count($productRows) > 0) {
                $lastItem = $productRows[count($productRows) - 1];
                $thTxt = $lastItem->find('th.ProductTable__th', 0)->text();
                if (trim($thTxt) == '状態') {
                    $status = $lastItem->find('a', 0)->text();
                }
            }
            $imgNodes = $html->find('ul.ProductImage__images', 0)->find('img');
            $imgUrls = [];
            foreach ($imgNodes as $img) {
                $imgUrls[] = oss_url($img->getAttribute('src'),1);
            }
            $content = $html->find('div.ProductExplanation__commentBody', 0)->innerHtml();
            $lis = $html->find('div.l-container', 0)->find('li');
            $attrList = [
                [
                    'name' => '商品ID',
                    'value' => $itemId
                ]
            ];
            $sellerA = $html->find('p.Seller__name', 0)->find('a', 0);
            $seller = $sellerA->text();
            $sellerHref = $sellerA->getAttribute("href");
            $sellerId = '';
            if(!empty($sellerHref)){
                $urlArr = explode('/',$sellerHref);
                $sellerId = end($urlArr);
            }
            $seller_address = $html->find('dd.Seller__areaName', 0)->text();

            //-- 获取评价信息
            $rateNode = $html->find('div.Seller__rating',0);
            $rateNum = 0;
            $ratePercent = '0.0%';
            if($rateNode){
                $rateNum = $rateNode->find('a.Seller__ratingLink',0)->text();
                $ratePercentNodeA = $rateNode->find('div.Seller__ratingStarOn');
                if($ratePercentNodeA && isset($ratePercentNodeA[0])){
                    $ratePercent = $ratePercentNodeA[0]->text();
                }
            }

            $inArr = [];
            $notAllow = ['入札者認証制限','入札者認証制限','クーポン名'];
            foreach ($lis as $li) {
                $name = $li->find('dt', 0)->text();
                $value = $li->find('dd', 0)->text();
                if (empty($name) || in_array($name,$inArr) || in_array($name,$notAllow)) {
                    continue;
                }
                $inArr[] = $name;
                $value = str_replace('：', '', $value);
                $attrList[] = [
                    'name' => $name,
                    'value' => trim($value)
                ];
            }

            $trs = $html->find('div.l-container', 0)->find('tr');
            foreach ($trs as $tr) {
                $name = $tr->find('th', 0)->text();
                $value = $tr->find('td', 0)->text();
                if (empty($name) || in_array($name,$inArr) || in_array($name,$notAllow)) {
                    continue;
                }
                $inArr[] = $name;
                $value = str_replace(['：',' '], '', $value);
                $value = str_replace(['\n'], '\\', $value);
                $attrList[] = [
                    'name' => $name,
                    'value' => trim($value)
                ];
            }


            //-- 立即购买价格
            $buynowPrice = 0;
            $priceNode = $html->find('dd.Price__value--buyNow', 0);
            if($priceNode){
                $buynowPrice = $priceNode->text();
                if(is_string($buynowPrice)){
                    $arr = explode('円',$buynowPrice);
                    $buynowPrice = $this->getNumberStr($arr[0]);
                }
            }

            $priceTitle = '';
            $priceTitleDiv = $html->find('dt.Price__title',0);
            if($priceTitleDiv){
                $priceTitle = $priceTitleDiv->text();
            }

            $durl = '';
            $delivery = $html->find('input#js-deliveryData',0);
            if($delivery){
                $durl = $delivery->getAttribute('data-url');
                $eappid = $delivery->getAttribute('data-eappid');
                $prefCode = $delivery->getAttribute('data-prefcode');
                $durl = sprintf("%s?pref_code=%d&eappid=%s&_%d",$durl,trim($prefCode),$eappid,time()*1000);
            }


            //-- 运费
//            $postTxt = $html->find('span.Price__postageValue',0)->text();
            $postTxt = '';

            $data = [
                'goods_name' => $goodsName.(trim($priceTitle) == '即決'?'(即決)':''),
                'content' => $content,
                'price' => $tax,
                'bid_num' => $bidNum,
                'left_time' => $leftTime,
                'bid_price' => $price,
                'fastprice' => floatval($buynowPrice),
                'cover' => count($imgUrls) > 0?$imgUrls[0]:'',
                'goods_no' => $itemId,
                'postTxt' => $postTxt,
                'durl' => $durl,
                'status' => trim($status),
                'extras' => json_encode($attrList, JSON_UNESCAPED_UNICODE),
                'imgurls' => json_encode($imgUrls),
                'seller' => $seller,
                'seller_id' => $sellerId,
                'rate_num' => $rateNum,
                'rate_percent' => $ratePercent,
                'seller_address' => $seller_address,
                'price_title' => trim($priceTitle)
            ];

            if($data['price_title'] == '即決' && $data['fastprice'] <=0){
                $data['fastprice'] = $data['bid_price'];
            }

            list($errcode, $result) = (new YahooGoods())->addRow($data);
            return $data;

        }
        catch (\Exception $e) {
            return $e->getMessage().$e->getLine();
        }
    }

    /**
     * 出价历史
     * @param $itemId
     * @return array|bool
     */
    public function bidHistory($itemId)
    {
        $url = 'https://auctions.yahoo.co.jp/jp/show/bid_hist?aID=' . $itemId;
        $info = \think\facade\Db::name('yahoo_accounts')
            ->where('login_status', 1)
            ->where('is_deleted', 0)
            ->find();
        $content = $this->doGetWithCookie($url, $info['cookies']);
        try {
            $html = HtmlDomParser::str_get_html($content);
            $div = $html->find('div[id=modCtgSearchResult]', 0);
            $table = $div->find('table', 0);
            if (!$table) {
                return false;
            }
            $trs = $table->find('tr');
            $historyList = [];
            foreach ($trs as $key => $input) {
                if ($key == 0) {
                    continue;
                }
                $tds = $input->find('td');
                $name = $tds[0]->text();
                $price = $tds[1]->text();
                $num = $tds[2]->text();
                $time = $tds[3]->text();
                $historyList[] = [
                    'name' => trim($name),
                    'price' => trim($price),
                    'num' => trim($num),
                    'time' => trim($time)
                ];
            }
            return $historyList;
        }
        catch (\Exception $e) {
            return false;
        }
    }

    /**
     * 发送掉线通知
     * @param $account
     */
    protected function setAlert($account){
        $key = 'yahoo_login_'.md5($account);
        $redis = new StRedis();
        $cache = $redis->get($key);
        if(intval($cache) > 0){
            return;
        }
        $redis->set($key,time(),7200);
        Wecom::sendAlertMsg('雅虎掉线通知',['账号：'.$account]);
    }

    /**
     * 竞拍中
     * @param $account
     * @param int $page
     * @return array|bool
     */
    public function bidding($account,$page=1)
    {
        $url = 'https://auctions.yahoo.co.jp/openuser/jp/show/mystatus?select=bidding&apg='.$page;
        $info = \think\facade\Db::name('yahoo_accounts')
            ->where('login_status', 1)
            ->where('account', $account)
            ->where('is_deleted', 0)
            ->find();
        if (!$info) {
            return false;
        }
        $content = $this->doGetWithCookie($url, $info['cookies']);
        if(empty($content)){
            return false;
        }
        if(stripos($content,'login.yahoo.co.jp/config/login') !==false && strlen($content) < 600){
            \think\facade\Db::name('yahoo_accounts')
                ->where('account',$account)
                ->save(['login_status' => 0]);
            //-- 发送通知
            $this->setAlert($account);
            throw  new \Exception('登录状态失效');
        }
        try {
            $html = HtmlDomParser::str_get_html($content);
            $div = $html->find('div[id=acWrContents]', 0);
            $table = $div->find('table.ItemTable', 0);
            if (!$table) {
                return false;
            }
            $trs = $table->find('tr');
            $bidingList = [];
            foreach ($trs as $key => $input) {
                if ($key == 0) {
                    continue;
                }
                $tds = $input->find('td');
                $a = $tds[0]->find('a', 0);
                $spanList = $a->find('span');
                if(count($spanList) <=0){
                    continue;
                }
                $status = $spanList[0]->text();
                //高値更新  最高額で入札中
                $coverUrl = $a->find('img', 0)->getAttribute('src');
                $href = $a->getAttribute('href');
                $goodsName = $tds[1]->find('a', 0)->text();
                $nowPrice = $tds[2]->text();
                $num = $tds[3]->text();
                $seller = $tds[4]->text();
                $bidingList[] = [
                    'status' => trim($status),
                    'cover' => oss_url($coverUrl),
                    'goodsNo' => $this->parseUrl($href),
                    'goodsName' => trim($goodsName),
                    'now_price' => trim(str_replace([',', '円'], '', trim($nowPrice))),
                    'num' => intval($num),
                    'seller' => $seller
                ];
            }
            return $bidingList;
        }
        catch (\Exception $e) {
            return false;
        }
    }

    /**
     * 落札分 竞拍成功的
     * @param $account
     * @param int $page
     * @return array|bool
     */
    public function bidwon($account,$page=1)
    {
        $url = 'https://auctions.yahoo.co.jp/closeduser/jp/show/mystatus?select=won&apg='.$page;
        $info = \think\facade\Db::name('yahoo_accounts')
            ->where('login_status', 1)
            ->where('account', $account)
            ->where('is_deleted', 0)
            ->find();
        if (!$info) {
            return false;
        }
        $content = $this->doGetWithCookie($url, $info['cookies']);
        if(empty($content)){
           return false;
        }
        if(stripos($content,'login.yahoo.co.jp/config/login') !==false && strlen($content) < 600){
            \think\facade\Db::name('yahoo_accounts')
                ->where('account',$account)
                ->save(['login_status' => 0]);
            //-- 发送通知
            $this->setAlert($account);
            throw  new \Exception('登录状态失效');
        }
        try {
            $html = HtmlDomParser::str_get_html($content);
            $div = $html->find('div[id=acWrContents]', 0);
            $trs = $div->find('tr.auc_del_style');
            $wonList = [];
            foreach ($trs as $key => $input) {
//                if ($key == 0) {
//                    echo '1111';
//                    continue;
//                }
                $tds = $input->find('td');
                $checkboxs = $tds[0]->find('input');
                if(empty($checkboxs)){
                    continue;
                }
                $goodsNo = $tds[1]->text();
                if(trim($goodsNo) == '商品ID'){
                    continue;
                }
                $goodsName = $tds[2]->text();
                $price = $tds[3]->text();
                $wonTime = $tds[4]->text();
                $seller = $tds[5]->text();
                $wonList[] = [
                    'goodsNo' => $goodsNo,
                    'goodsName' => trim($goodsName),
                    'price' => trim(str_replace([',', '円'], '', trim($price))),
                    'won_time' => trim($wonTime),
                    'seller' => $seller
                ];
            }
            return $wonList;
        }
        catch (\Exception $e) {
            return false;
        }
    }

    private function getNumberStr($str)
    {
        return preg_replace('/\D/s', '', $str);
    }

    private function parseCats($ul)
    {
        $liArr = $ul->childNodes();
        foreach ($liArr as $li) {
            $input = $li->find('input', 0);
            $data = [
                'name' => trim($li->text()),
                'type' => 'yahoo',
                'pid' => 0,
                'data' => trim($input->getAttribute('value')),
                'create_time' => time()
            ];
            if (empty($data['name'])) {
                continue;
            }
            $insertId = \think\facade\Db::name('cats')
                ->insert($data, true);

        }
    }

    /**
     * 商品详情
     * @param $itemId
     * @return array|bool
     */
    public function paypayDetail($itemId)
    {
        $url = 'https://paypayfleamarket.yahoo.co.jp/item/' . $itemId;
        $content = $this->doGet($url);
        if (!$content) {
            return false;
        }

        file_put_contents(runtime_path().'yahoo_paypay.html',$content);
        $html = HtmlDomParser::str_get_html($content);
        try {
            $goodsName = $html->find('h1.ItemTitle__Component', 0)->text();
            $priceTxt = $html->find('span.ItemPrice__Component', 0)->text();
            $priceTxt = str_replace([',','円'],'',trim($priceTxt));

            $imgNodes = $html->find('div.slick-list', 0)->find('img');
            $imgUrls = [];
            foreach ($imgNodes as $img) {
                $imgUrls[] = oss_url($img->getAttribute('src'),1);
            }

            $table = $html->find('table.ItemTable__Component',0);
            $trs = $table->find('tr');
            $attr = [];
            foreach ($trs as $tr){
                $name = $tr->find('th',0)->text();
                $value = $tr->find('td',0)->text();
                $attr[trim($name)] = trim($value);
            }
            $seller = $html->find('div.UserInfo__Name', 0)->text();
            $data = [
                'goods_name' => trim($goodsName),
                'content' => '',
                'price' => $priceTxt,
                'cover' => count($imgUrls) > 0?$imgUrls[0]:'',
                'ext_goods_no' => $itemId,
                'imgurls' => json_encode($imgUrls),
                'seller' =>  $seller,
                'seller_address' => isset($attr['発送元の地域'])?$attr['発送元の地域']:'',
            ];

            return $data;

        }
        catch (\Exception $e) {
            return $e->getMessage().$e->getLine();
        }
    }



    private function doGet($url = '')
    {
        $header = [
            'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.106 Safari/537.36',
            'accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
            'accept-language: zh-CN,zh;q=0.9,en;q=0.8,ja;q=0.7,zh-TW;q=0.6',
            'referer: https://auctions.yahoo.co.jp/search/search?p=1&auccat=26318&va=1&fixed=3&exflg=1&b=851&n=50',
//            'accept-encoding: deflate, br',
        ];
        if (env('app.proxy', 0) != 0) {
            $result = request_proxy($url, 'GET', [], $header);
            return $result;
        }

        $curl = curl_init();
        curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($curl, CURLOPT_TIMEOUT, 30);
        curl_setopt($curl, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($curl, CURLOPT_SSL_VERIFYHOST, false);
        curl_setopt($curl, CURLOPT_URL, $url);
        curl_setopt($curl, CURLOPT_HTTPHEADER, $header);
        $res = curl_exec($curl);
//        $info = curl_getinfo($curl);
//        print_r($info);
        curl_close($curl);
        return $res;
    }

    /**
     * 接口出价
     * @param $accountInfo
     * @param $goodsNo
     * @param $price
     */
    public function doBid($info, $goodsNo, $price,$lastReqId=0)
    {
//        $url = 'https://page.auctions.yahoo.co.jp/jp/auction/' . $goodsNo;
        $url = 'https://auctions.yahoo.co.jp/jp/auction/' . $goodsNo;
        $content = $this->doGetWithCookie($url, $info['cookies']);
        if(empty($content)){
            throw new \Exception('读取登录状态失效');
        }

        if(stripos($content,'login.yahoo.co.jp/config/login?') !==false && strlen($content) < 200){
            \think\facade\Db::name('yahoo_accounts')
                ->where('account',$info['account'])
                ->save(['login_status' => 0]);
            //-- 发送通知
            $this->setAlert($info['account']);
            throw  new \Exception('登录状态失效');
        }

//        if(stripos($content,'https://') !== false){
//            $content = $this->doGetWithCookie($content, $info['cookies']);
//            if(empty($content)){
//                throw new \Exception('读取登录状态失效');
//            }
//        }

        try {
//            \think\facade\Db::name("debug_logs")->insert(['content' => $content]);
//            file_put_contents(runtime_path().'/yahoo.html',$content);
//            $html = HtmlDomParser::str_get_html($content);
//            $div = $html->find('div.BidModal__body', 0);
//            $form = $div->find('form', 0);
//            if (!$form) {
//                throw new \Exception('获取表单数据失败');
//            }
//            $inputs = $form->find('input');
//            if(empty($inputs)){
//                throw new \Exception('竞价失败，请稍后再试');
//            }
//            $params = [];
//            foreach ($inputs as $input) {
//                $name = $input->getAttribute('name');
//                $value = $input->getAttribute('value');
//                if (!empty($name)) {
//                    $params[$name] = $value;
//                }
//            }
//            cc: jp
//ItemID: b1178371235
//login: kangaroojapan888
//Quantity: 1
//Bid: 21
//CategoryID: 2084250968
//            $params['Bid'] = $price;
//            $params = [
//                'cc' => 'jp',
//                'ItemID' => $goodsNo,
//                'login' => $info['account'],
//                'Quantity' => 1,
//                'Bid' => $price,
//                'CategoryID' => '2084250968'
//            ];

            $params = [
                'price' => $price,
                'quantity' => 1,
                'isPartial' => false,
                'isBuyNow' => false,
            ];

            //-- 提交到确认页面
//            $url = 'https://auctions.yahoo.co.jp/jp/show/bid_preview';
            $url = sprintf("https://auctions.yahoo.co.jp/api/bid/v1/items/%s/bid/preview?price=%s&quantity=1&isPartial=false&isBuyNow=false",$goodsNo,$price);
            $content = $this->doGetWithCookie($url, $info['cookies'], 'GET');
            $logs = $url .$content;
//            file_put_contents(runtime_path().'yahoo_bid.html',$logs);
            $resArr = json_decode($content,true);
            if(!$resArr){
                throw new \Exception('获取提交表单失败');
            }
            if(isset($resArr['error'])){
                throw new \Exception($resArr['error']['message']);
            }

            //{"price":11,"nextBidPrice":11,"quantity":1,"isAutoRebid":true,"user":{"isUnder18":false,"isNewBid":true,"isFirstBid":false,"isWinner":false,"isHighestBidder":false}}
//            if (strpos($content, '出品者のブラックリストに登録されているため、入札できません。') !== false) {
//                return -1;
//            }
//            file_put_contents(runtime_path().'yahoo_bid.html',$url .$content);
//            $html = HtmlDomParser::str_get_html($content);
//            $SubmitBox = $html->find('div.SubmitBox', 0);
//            if (!$SubmitBox) {
//                throw new \Exception('获取提交表单失败');
//            }
//            $submitInputs = $SubmitBox->find('input');
//            $submitData = [];
//            foreach ($submitInputs as $sinput) {
//                $name = $sinput->getAttribute('name');
//                $value = $sinput->getAttribute('value');
//                if (!empty($name)) {
//                    $submitData[$name] = $value;
//                }
//            }
//
//            if (empty($submitData)) {
//                throw new \Exception('发起竞价请求失败请联系客服处理。');
//            }

            //-- 开始确认出价
            $url = 'https://auctions.yahoo.co.jp/jp/config/placebid';
            $url = sprintf("https://auctions.yahoo.co.jp/api/bid/v1/items/%s/bid",$goodsNo);
            $submitData = [
                'price' => $price,
                'quantity' => 1,
                'isRegisterSNL' => true,
                'isAcceptAuth' => false,
                'isBuyNow' => false,
                'isPartial' => false,
                'token' => $resArr['token']
            ];
            $content = $this->doGetWithCookie($url, $info['cookies'], 'POST',$submitData,true);

            $logs = $logs.$url.$content.json_encode($submitData);
            file_put_contents(runtime_path().'yahoo_bid.html',$logs);

            $resArr = json_decode($content,true);
            if(isset($resArr['error'])){
                throw new \Exception($resArr['error']['message']);
            }
//            \think\facade\Db::name('yahoo_bid_log')->insert([
//                'uid' => $uid,
//                'account' => $info['account'],
//                'goods_no' => $goodsNo,
//                'price' => $price,
//                'result' => $content??'',
//                'time' => date('Y-m-d H:i:s',time())
//            ]);

//            if (strpos($content, '自動入札であなたの入札価格を上回る入札が行われました。') !== false) {
//                throw new \Exception('您的出价过低请从新出价。');
//            }
//            else if (strpos($content, '出品者のブラックリストに登録されているため、入札できません。') !== false) {
//                return -1;
//            }
//            elseif (strpos($content, 'あなたが現在の最高額入札者です。') !== false || strpos($content,'あなたが落札しました。') !== false) {
//                return 200;
//            }
//            else if(stripos($content,'自動入札であなたの入札価格を上回る入札が行われま') !== false){
//                throw new \Exception('您的出价过低请从新出价。');
//            }
//            elseif (strpos($content, 'この出品者のオークションへの入札はできません。') !== false) {
//                throw new \Exception("この出品者のオークションへの入札はできません。");
//            }else if(stripos($content,'入札する金額は') !== false){
//                throw new \Exception('出价过低，请提高您的出价');
//            }
            return 200;
        }
        catch (\Exception $e) {
            \think\facade\Db::name("debug_logs")->insert(['content' => $e->getMessage().' | '.$e->getLine()]);
            throw $e;
        }
    }

    private function doGetWithCookie($url = '', $cookies, $method = 'GET', $params = [],$isJson = false)
    {
        $header = [
            'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.106 Safari/537.36',
            'accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
            'accept-language: zh-CN,zh;q=0.9,en;q=0.8,ja;q=0.7,zh-TW;q=0.6',
            'referer: https://auctions.yahoo.co.jp/search/search?p=1&auccat=26318&va=1&fixed=3&exflg=1&b=851&n=50',
            'cookie: ' . $cookies,
            'accept-encoding: deflate, br',
        ];
        if($isJson){
            $header = [
                'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.106 Safari/537.36',
                'accept: application/json, text/plain, */*',
                'accept-language: ja,zh-CN;q=0.9,zh;q=0.8,en-US;q=0.7,en;q=0.6,zh-TW;q=0.5',
                'origin: https://auctions.yahoo.co.jp',
                'referer: https://auctions.yahoo.co.jp/jp/auction/h1204553472',
                'cookie: ' . $cookies,
                'accept-encoding: deflate, br',
            ];
            $header[] = 'x-csrf-token: '.$params['token'];
            unset($params['token']);
            $header[] = 'content-type: application/json';
            $header[] = 'content-length: ' . strlen(json_encode($params));
            $params = json_encode($params);
        }
        if (env('app.proxy', 0) != 0) {
            $result = request_proxy($url, $method, $params, $header);
            return $result;
        }

        $isHeader = false;
        if(stripos($url,'bid/preview') !== false){
            $isHeader = true;
        }

        $curl = curl_init();
        curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($curl, CURLOPT_TIMEOUT, 30);
        curl_setopt($curl, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($curl, CURLOPT_SSL_VERIFYHOST, false);
        curl_setopt($curl, CURLOPT_URL, $url);
        if ($method != 'GET') {
            curl_setopt($curl, CURLOPT_CUSTOMREQUEST, $method);
            curl_setopt($curl, CURLOPT_POSTFIELDS, $params);
        }
        curl_setopt($curl, CURLOPT_HTTPHEADER, $header);

        $responseHeader = [];
        if($isHeader){
            curl_setopt($curl, CURLOPT_HEADERFUNCTION, function($curl, $headerLine) use (&$responseHeader) {
                // 处理每一行Header（过滤空行）
                $trimmed = trim($headerLine);
                if (!empty($trimmed)) {
                    $responseHeader[] = $trimmed;
                }
                return strlen($headerLine); // 必须返回当前行的长度，否则cURL会中断
            });
        }
        $res = curl_exec($curl);
        $info = curl_getinfo($curl);
        curl_close($curl);
        if($info['http_code'] == 302){
            return $info['redirect_url'];
        }
        if($isHeader){
            $resArr = json_decode($res,true);
            $token = '';
            foreach($responseHeader as $str){
                if(stripos($str,'X-Csrf-Token: ') !== false){
                    $token = str_replace('X-Csrf-Token: ','',$str);
                }
            }
            $resArr['token'] = $token;
            return json_encode($resArr);
        }
        return $res;
    }

}