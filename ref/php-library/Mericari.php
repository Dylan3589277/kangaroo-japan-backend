<?php
namespace app\common\library;
use app\admin\controller\Config;
use app\common\model\Configs;
use app\common\model\Goods;
use app\common\model\MercariGoods;
use think\facade\Db;
use think\facade\Request;
use Tools\StRedis;
use voku\helper\HtmlDomParser;

/**
 * Created by PhpStorm.
 * Date: 2021/8/22
 * Time: 16:48
 * description:
 * https://www.mercari.com/jp/category/1/
 */
class Mericari{

    private $proxy = false;

    //private $proxy = false;

    private $dpop = '';

    /**
     * 同步分类
     */
    public function cats(){
//        $url = 'https://www.mercari.com/jp/';
//        $content = $this->doGet($url);
        $content = '';
        $html = HtmlDomParser::str_get_html($content);
        $ul = $html->find('ul',0);
        $this->parseCats($ul,0);
    }

    public function parseUrl($url){
        $href = trim($url,'/');
        $hrefArr = explode('/',$href);
        return trim(array_pop($hrefArr));
    }

    /**
     * 搜索商品
     * @param $page
     * @param $categoryRoot
     * @param string $categoryChild
     * @param string $keyword
     * @param string $sort
     * @return array|bool
     */
    public function searchGoods($page,$categoryRoot,$categoryChild='',$keyword='',$sort='',$status_on_sale=1){

        //https://api.mercari.jp/search_index/search?sort=created_time&order=desc&limit=120&category_id=1&page=0
        $where = [
            'page' => $page,
            'category_root' => $categoryRoot,
            'category_child' => $categoryChild,
            'keyword' => $keyword,
            'sort_order' => $sort,
            'brand_name' => '',
            'brand_id' => '',
            'size_group' => '',
            'price_min' => '',
            'price_max' => '',
            'status_on_sale' => $status_on_sale
        ];

        try{
            $url = sprintf('https://www.mercari.com/jp/search/?%s',http_build_query($where));
            $content = $this->doGet($url);
            if(!$content){
                return false;
            }
            $html = HtmlDomParser::str_get_html($content);
            $sections = $html->find('section.items-box');
            $goodsList = [];
            if($sections){
               // $model = new MercariGoods();
                foreach ($sections as $li){
                    $a = $li->find('a',0);
                    if(!$a){
                        continue;
                    }
                    $href = $a->getAttribute('href');
                    $goodsName = $a->find('h3.items-box-name',0)->text();
                    $imgUrl = $a->find('img',0)->getAttribute('data-src');
                    $price = $a->find('div.items-box-price',0)->text();
                    $price = str_replace(['¥',','],'',trim($price));
                    $href = trim($href,'/');
                    $hrefArr = explode('/',$href);
                    $data = [
                        'goods_name' => trim($goodsName),
                        'cover' => oss_url($imgUrl),
                        'price' => trim($price),
                        'cat' => intval($categoryRoot),
                        'goods_no' => trim(array_pop($hrefArr))
                    ];
                    //$model->addRow($data);
                    $goodsList[] = $data;
                }
            }
            $pageNext = $html->find('li.pager-next',0);
            $totalPages = 1;
            if($pageNext){
                $aArr = $pageNext->find('a');
                foreach ($aArr as $a){
                    $href = $a->getAttribute('href');
                    $result = [];
                    $href = str_replace('&amp;','&',$href);
                    $urlArr = parse_url(urldecode($href));
                    parse_str($urlArr['query'],$result);
                    if(isset($result['page']) && intval($result['page']) > $totalPages){
                        $totalPages = intval($result['page']);
                    }
                }
            }

            return compact('goodsList','totalPages');
        }catch (\Exception $e){
            return false;
        }

    }

    public function search($page,$cat,$kw='',$sort='',$sellerId='',$proxy=false){

        $json = '{"userId":"","pageSize":120,"pageToken":"","searchSessionId":"6cc647cd2fbfaeb2001aac91e146cb2f","indexRouting":"INDEX_ROUTING_UNSPECIFIED","thumbnailTypes":[],"searchCondition":{"keyword":"","excludeKeyword":"","sort":"SORT_SCORE","order":"ORDER_DESC","status":[],"sizeId":[],"categoryId":[1],"brandId":[],"sellerId":[],"priceMin":0,"priceMax":0,"itemConditionId":[],"shippingPayerId":[],"shippingFromArea":[],"shippingMethod":[],"colorId":[],"hasCoupon":false,"attributes":[],"itemTypes":[]},"defaultDatasets":[],"serviceFrom":"suruga"}';

        $order = '';
        if(!empty($sort)){
            $arr = explode('|',$sort);
            $order = $arr[1];
            $sort = $arr[0];
        }

        $whereArr = json_decode($json,true);
        $whereArr['pageToken'] = "v1:".$page;
        $whereArr['searchSessionId'] = uniqid();
        $whereArr['searchCondition']['categoryId'] = [$cat?$cat:0];
        $whereArr['searchCondition']['keyword'] = $kw;
        $whereArr['searchCondition']['order'] = empty($order)?'ORDER_DESC':$order;
        $whereArr['searchCondition']['sort'] = empty($sort)?'SORT_SCORE':$sort;

        if(!empty($sellerId)){
            $whereArr['searchCondition']['sellerId'] = [$sellerId];
        }


        $params = [
            'page' => $page,
            'category_id' => $cat,
            'limit' => 120,
            'sort' => $sort,
            'order' => $order,
            'keyword' => $kw
        ];
//        $configArr = (new Configs())->where('name','MERCARI_SEARCH_TOKEN')->value('value');
//        $this->dpop = $configArr;
        if(Request::ip() == '0.0.0.0'){
            return false;
        }
        $info = \think\facade\Db::name('mercari_dpops')
            ->where('type','search')
            ->where('create_time','>',strtotime(date('Y-m-d')))
            ->orderRand()->find();
        if($info){
            \think\facade\Db::name('mercari_dpops')->where('id',$info['id'])->update(['update_time' => time(),'ip' => Request::ip()]);
            $this->dpop = $info['dpop'];
        }

        $url = 'https://api.mercari.jp/v2/entities:search';
        $content = $this->doPost($url,json_encode($whereArr),15,false,$proxy);
//        var_dump($content);
        if(empty($content)){
            return false;
        }
        try{
            $resArr = json_decode($content,true);
            if(is_null($resArr) || !isset($resArr['items'])){
                return false;
            }
            $goodsList = [];
            foreach ($resArr['items'] as $item){
                $goodsList[] = [
                    'goods_name' => trim($item['name']),
                    'cover' => oss_url($item['thumbnails'][0]),
                    'price' => trim($item['price']),
                    'seller' => trim($item['sellerId']),
                    'seller_address' => '',
                    'status' => $item['status'],
                    'goods_no' => trim($item['id'])
                ];
            }
            $totalPages = ceil($resArr['meta']['numFound']/120);
            return compact('goodsList','totalPages');
        }catch (\Exception $e){
            return false;
        }

    }

    /**
     * 检测是否可以自动购买
     * @param $gid
     * @return array
     */
    public function checkAutoBuy($gid){
        $ruleArr = explode(',',trim(config('config.AUTO_BUY_KEYWORDS','')));
        foreach ($ruleArr as $key => $value){
            if(empty(trim($value))){
                unset($ruleArr[$key]);
            }
        }
        if(empty($ruleArr)){
            return [-1,'获取关键词失败'];
        }

        $key = sprintf('mercari_%s',$gid);
        $redis = new StRedis();
        $json = $redis->get($key);
        if(!empty($json)){
            $data = is_array($json)?$json:json_decode($json,true);
        }else{
            $data = $this->gooddetail($gid);
        }

        if(!$data){
            return [-1,'获取商品信息失败'];
        }
        $sellerInfo = $this->getSellerDetail($data['seller_info']['id']);
        if(!$sellerInfo){
            return [-1,'获取卖家信息失败'];
        }
        $strArr = [
            $data['goods_name'],
            $data['description'],
            $data['content'],
            $sellerInfo['introduction'],
            $sellerInfo['name'],
        ];
        foreach ($strArr as $str){
            preg_match_all('#('.implode('|', $ruleArr).')#', $str, $result);
            if($result[0] && count($result[0]) > 0){
                //-- 包含关键词
                return [1,implode(',',$result[0])];
            }
        }
        return [0,'不包含关键词'];
    }

    /**
     * 获取
     * @param $id
     * @return false|mixed
     */
    public function getSellerDetail($id){
        $configArr = (new Configs())->getAllArr();
        $this->dpop = $configArr['MERCARI_PROFILE_TOKEN'];
        $url = sprintf('https://api.mercari.jp/users/get_profile?user_id=%s&_user_format=profile',$id);
        $content = $this->doGet($url);
        if(empty($content)){
            return false;
        }
        try {
            $resArr = json_decode($content, true);
            if (is_null($resArr) || !isset($resArr['data'])) {
                return false;
            }
            return  $resArr['data'];
        }catch (\Exception $e){
            return false;
        }
    }

    public function gooddetail($itemId,$retry=0){

//        $existGoodsInfo = Db::name('goods_mercaris')
//            ->where('goods_no',$itemId)
//            ->where('update_time','>',1726394434)
//            ->field('goods_name,description,content,price,extras,imgurls,seller,seller_id,seller_info,cover,goods_no,status,seller_address')
//            ->find();
//        if($existGoodsInfo){
//            $existGoodsInfo['ext_goods_no'] = $itemId;
//            $existGoodsInfo['seller_info'] = json_decode($existGoodsInfo['seller_info'],true);
//            return $existGoodsInfo;
//        }


        $configArr = (new Configs())->getAllArr();
        $this->dpop = $configArr['MERCARI_DETAIL_TOKEN'];
        $info = \think\facade\Db::name('mercari_dpops')
            ->where('type','detail')
            ->where('create_time','>',time()-86400*2)
            ->order('update_time asc,create_time desc')
            ->find();
        if($info){
            \think\facade\Db::name('mercari_dpops')->where('id',$info['id'])->update(['update_time' => time(),'ip' => Request::ip()]);
            $this->dpop = $info['dpop'];
        }
        $url = sprintf('https://api.mercari.jp/items/get?id=%s&include_item_attributes=true&include_product_page_component=true&include_non_ui_item_attributes=true&include_offer_like_coupon_display=true&include_offer_coupon_display=true&include_item_attributes_sections=true&include_auction=true',$itemId);
        $content = $this->doGet($url);
        if(empty($content)){
            return false;
        }
        try{
            $resArr = json_decode($content,true);
            if(is_null($resArr) || !isset($resArr['data'])){
                if($retry > 2){
                    return false;
                }
                return $this->gooddetail($itemId,$retry+1);
            }
            $resArr = $resArr['data'];
            $imgUrls = [];
            foreach ($resArr['photos'] as $pic){
                $imgUrls[] = oss_url($pic,1);
            }
            $fields = [
                ['key' => 'item_brand','label' => '品牌'],
                ['key' => 'item_category','label' => '分类'],
                ['key' => 'item_size','label' => '尺寸'],
                ['key' => 'seller','label' => '卖家'],
                ['key' => 'shipping_duration','label' => '发货时间'],
                ['key' => 'shipping_from_area','label' => '发货地址'],
                ['key' => 'shipping_method','label' => '发货方式'],
                ['key' => 'shipping_payer','label' => '运费支付方式'],
            ];
            $attrList = [
                [
                    'name' => '商品ID',
                    'value' => $itemId
                ]
            ];
            foreach ($fields as $field){
                if(isset($resArr[$field['key']]) && isset($resArr[$field['key']]['name'])){
                    $attrList[] = [
                        'name' => $field['label'],
                        'value' => $resArr[$field['key']]['name']
                    ];
                }
            }
            $descArr = [];
            if(isset($resArr['item_size'])){
                $descArr[] = $resArr['item_size']['name'];
            }
            if(isset($resArr['item_category'])){
                $descArr[] = $resArr['item_category']['name'];
            }
            if(isset($resArr['item_brand'])){
                $descArr[] = $resArr['item_brand']['name'];
            }
            $data =  [
                'goods_name' => trim($resArr['name']),
                'description' => implode(' / ',$descArr),
                'content' => $resArr['description'],
                'price' => $resArr['price'],
                'extras' => json_encode($attrList,JSON_UNESCAPED_UNICODE),
                'imgurls' => json_encode($imgUrls),
                'seller' => $resArr['seller']['name'],
                'seller_id' => $resArr['seller']['id'],
                'seller_info' => $resArr['seller'],
                'cover' => $imgUrls[0],
                'goods_no' => $itemId,
                'status' => $resArr['status'],
                'ext_goods_no' => $itemId,
                'seller_address' => $resArr['shipping_from_area']['name']
            ];
            (new MercariGoods())->addRow($data);
            (new Goods())->addRow($data);

//            if(isset($resArr['is_offerable_v2'])){
//                $data['is_offerable_v2'] = boolval($resArr['is_offerable_v2']);
//            }

            if(isset($resArr['auction_info'])){
                $data['is_offerable_v2'] = true;
                $data['status'] = 'sold_out';
            }

//            $data['res_arr'] = $resArr;

            return $data;
        }catch (\Exception $e){
            return false;
        }
    }

    /**
     * 读取商品列表
     * @param int $category
     * @param int $page
     * @return array|bool
     */
    public function goodslist($category=1,$page=1){
        try{
            $url = sprintf('https://www.mercari.com/jp/category/%s/?page=%s',$category,$page);
            $content = $this->doGet($url);
            $html = HtmlDomParser::str_get_html($content);
            $ul = $html->find('ul.hYahgh',0);
            $goodsList = [];
            if($ul){
                $lis = $ul->find('li');
                $model = new MercariGoods();
                foreach ($lis as $li){
                    $a = $li->find('a',0);
                    if(!$a){
                        continue;
                    }
                    $href = $a->getAttribute('href');
                    $goodsName = $a->find('span',0)->text();
                    $imgUrl = $a->find('img',0)->getAttribute('data-src');
                    $price = $a->find('div.style_thumbnail__N_xAi',0)->find('span',0)->text();
                    $price = str_replace(['¥',','],'',trim($price));
                    $href = trim($href,'/');
                    $hrefArr = explode('/',$href);
                    $data = [
                        'goodsName' => $goodsName,
                        'cover' => oss_url($imgUrl),
                        'price' => $price,
                        'goods_no' => array_pop($hrefArr)
                    ];
                    $model->addRow($data);
                    $goodsList[] = $data;
                }
            }
            return $goodsList;
        }catch (\Exception $e){
            return false;
        }
    }


    /**
     * 商品详情
     * @param $itemId
     * @return array|bool
     */
    public function gooddetail1($itemId){
        //https://api.mercari.jp/items/get?id=m26604176898
        $url = 'https://www.mercari.com/jp/items/'.$itemId.'/';
        $content = $this->doGet($url);
        if(empty($content)){
            return false;
        }
        $html = HtmlDomParser::str_get_html($content);
        try{
            $goodsName = $html->find('h1.item-name',0)->text();
            $goodsDesc = $html->find('p.item-wording',0)->text();
            $goodsPrice = $html->find('span.item-price',0)->text();
            $goodsPrice = str_replace(['¥',','],'',trim($goodsPrice));
            $imgNodes = $html->find('div.item-photo',0)->find('img');
            $imgUrls = [];
            foreach ($imgNodes as $img){
                $imgUrls[] = oss_url($img->getAttribute('data-src'));
            }
            $content = $html->find('p.item-description-inner',0)->text();
            $trs = $html->find('table.item-detail-table',0)->find('tr');
            $attrList = [];
            $seller = '';
            $seller_address = '';
            foreach ($trs as $tr){

                $th = $tr->find('th',0)->text();
                if($th == '出品者'){
                    $td = $tr->find('td',0)->find('a',0)->text();
                    $seller = $td;
                }else if($th == 'カテゴリー'){
                    $as = $tr->find('td',0)->find('a');
                    $temps = [];
                    foreach ($as as $a){
                        $temps[] = $a->text();
                    }
                    $td = implode($temps,PHP_EOL);
                }else{
                    $td = $tr->find('td',0)->text();
                }

                if($th == '配送元地域'){
                    $seller_address = $td;
                }

                $attrList[] = [
                    'name' => $th,
                    'value' => $td
                ];
            }
            $data =  [
                'goods_name' => $goodsName,
                'description' => $goodsDesc,
                'content' => $content,
                'price' => $goodsPrice,
                'extras' => json_encode($attrList,JSON_UNESCAPED_UNICODE),
                'imgurls' => json_encode($imgUrls),
                'seller' => $seller,
                'cover' => $imgUrls[0],
                'goods_no' => $itemId,
                'ext_goods_no' => $itemId,
                'seller_address' => $seller_address
            ];

            (new MercariGoods())->addRow($data);
            (new Goods())->addRow($data);
            return $data;
        }catch (\Exception $e){
            return false;
        }
    }

    private function parseCats($ul,$pid){
        $liArr = $ul->childNodes();
//        echo $liArr->find('a',0)->text();
//        exit();
        foreach ($liArr as $li){
            $a = $li->find('a',0);
            $data = [
                'name' => $a->text(),
                'type' => 'mericari',
                'pid' => $pid,
                'create_time' => time()
            ];
            $href = $a->href;
            if(!empty($href)){
                $temp = explode('/',trim($href,'/'));
                $data['data'] = array_pop($temp);
            }
            $uls = $li->find('ul');
            $insertId =  \think\facade\Db::name('cats')
                ->insert($data,true);
            if(isset($uls[0]) && $insertId){
                $this->parseCats($uls[0],$insertId);
            }

        }
    }


    public function getIndexData(){
        $configArr = (new Configs())->getAllArr();
        $this->dpop = $configArr['MERCARI_INDEX_TOKEN'];
        $url = "https://api.mercari.jp/store/get_items?type=category&limit=60";
        $result = $this->doGet($url);
        var_dump($result);
        if(empty($result)){
            return false;
        }
        try{
            $resArr = json_decode($result,true);
            if(is_null($resArr) || !isset($resArr['data'])){
                return false;
            }
            $goodsList = [];
            $key = 'index_goods_recomand';
            $redis = new StRedis();
            foreach ($resArr['data'] as $item){
                $goodsList[] = [
                    'goods_name' => $item['name'],
                    'cover' => oss_url($item['thumbnails'][0]),
                    'price' => trim($item['price']),
                    'goods_no' => trim($item['id'])
                ];
            }

            $data = [];
            if(!empty($goodsList)){
                $data = [
                    [
                        'catId' => 1,
                        'catName' => '煤炉推荐',
                        'url' => '/pages/daishujun/category/category',
                        'goodsList' => $goodsList
                    ]
                ];
                $redis->set($key,json_encode($data,JSON_UNESCAPED_UNICODE),7*86400);
            }

            return $data;
        }catch (\Exception $e){
            return false;
        }


        /*
        $url = 'https://www.mercari.com/jp/';
        $content = $this->doGet($url);
        if(empty($content)){
            return false;
        }
        $html = HtmlDomParser::str_get_html($content);
        try{

            $catDivs = $html->find('div.sc-iIHSe');
            $data = [];
            $key = 'index_goods_recomand';
            $redis = new StRedis();
            foreach ($catDivs as $div){
                $items = $div->find('div.sc-gldTML');

                foreach ($items as $item){
                    $catName = $item->find('h3',0)->text();
                    $catLink = $item->find('a',0)->getAttribute('href');
                    var_dump($catLink);
                    $href = trim($catLink,'/');
                    $hrefArr = explode('/',$href);
                    $catId = array_pop($hrefArr);
                    $result = $this->searchGoods(1,$catId);
                    var_dump($catId);

                    if(isset($result['goodsList']) && !empty($result['goodsList'])){

                        $data[] = [
                            'catName' => $catName,
                            'catId' => $catId,
                            'goodsList' => array_slice($result['goodsList'],0,15)
                        ];

                    }





                    var_dump($catName);
                }
            }

            if(!empty($data)){
                $redis->set($key,json_encode($data,JSON_UNESCAPED_UNICODE),7*86400);
            }

            return $data;

        }catch (\Exception $e){
            return false;
        }
        */
    }


    public function shopGooddetail($itemId){
        $info = \think\facade\Db::name('mercari_dpops')
            ->where('type','shop_goods_detail')
            ->where('create_time','>',time()-86400*2)
            ->order('update_time asc')
            ->find();
        if($info){
            \think\facade\Db::name('mercari_dpops')->where('id',$info['id'])->update(['update_time' => time(),'ip' => Request::ip()]);
            $this->dpop = $info['dpop'];
        }
        $url = sprintf('https://api.mercari.jp/v1/marketplaces/shops/products/%s?view=FULL&imageType=JPEG',$itemId);
        $content = $this->doGet($url);
        if(empty($content)){
            return false;
        }
        try{
            $resArr = json_decode($content,true);
            if(is_null($resArr) || !isset($resArr['productDetail'])){
                return false;
            }
            $productDetail = $resArr['productDetail'];
            $imgUrls = [];
            foreach ($productDetail['photos'] as $pic){
                $imgUrls[] = oss_url($pic,1);
            }

            $data =  [
                'goods_name' => trim($resArr['displayName']),
                'description' => '',
                'content' => $productDetail['description'],
                'price' => $resArr['price'],
                'extras' => '',
                'imgurls' => json_encode($imgUrls),
                'seller' => $productDetail['shop']['displayName'],
                'seller_id' => $productDetail['shop']['name'],
                'seller_info' => $productDetail['shop'],
                'cover' => $imgUrls[0],
                'goods_no' => $itemId,
                'ext_goods_no' => $itemId,
                'seller_address' => $productDetail['shippingFromArea']['displayName']
            ];
            return $data;
        }catch (\Exception $e){
            return false;
        }
    }


    private function doGet($url = '')
    {
        $header = [
//            ':authority: api.mercari.jp',
//            ':method: GET',
//            ':path: /store/get_items?type=category&limit=60',
//            ':scheme: https',
            'Accept: application/json, text/plain, */*',
//            'Accept-Encoding: deflate, br',
            'Accept-Language: zh-CN,zh;q=0.9,en;q=0.8,ja;q=0.7,zh-TW;q=0.6',
            $this->dpop,
            'Host: api.mercari.jp',
            'Origin: https://jp.mercari.com',
            'Referer: https://jp.mercari.com/',
            'Sec-Fetch-Dest: empty',
            'Sec-Ch-Ua: "Google Chrome";v="119", "Chromium";v="119", "Not?A_Brand";v="24"',
            'Sec-Ch-Ua-Mobile: ?0',
            'Sec-Ch-Ua-Platform: "macOS"',
            'Sec-Fetch-Mode: cors',
            'Sec-Fetch-Site: cross-site',
            'User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1',
            'X-Platform: web',
        ];

        if(env('app.proxy',0) !=0){
            $result = request_proxy($url,'GET',[],$header);
            return $result;
        }

        $curl = curl_init();
        curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($curl, CURLOPT_TIMEOUT, 30);
        curl_setopt($curl, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($curl, CURLOPT_SSL_VERIFYHOST, false);
        curl_setopt($curl, CURLOPT_URL, $url);
        curl_setopt($curl, CURLOPT_HTTPHEADER,$header);
        $res = curl_exec($curl);
        curl_close($curl);
        return $res;
    }


    function doPost($url, $param = [], $timeout = 30,  $isbuild = true,$proxy=false)
    {
        if (empty($url)) {
            return false;
        }
        if ($isbuild) {
            $param = http_build_query($param);
        }

//        var_dump($param);
        $header = [
//            ':authority: api.mercari.jp',
//            ':method: GET',
//            ':path: /store/get_items?type=category&limit=60',
//            ':scheme: https',
            'Accept:  */*',
//            'accept-encoding: deflate, br',
//            'accept-language: zh-CN,zh;q=0.9,en;q=0.8,ja;q=0.7,zh-TW;q=0.6',
            $this->dpop,
//            'Content-Type: application/json',
            'Origin: https://jp.mercari.com',
            'Host: api.mercari.jp',
            'Referer: https://jp.mercari.com/',
            'sec-fetch-dest: empty',
            'sec-fetch-mode: cors',
            'sec-fetch-site: cross-site',
            'User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1 ',
            'X-Platform: web',
        ];

        $header = [
            ':authority:api.mercari.jp',
            ':method:POST',
            ':path:/v2/entities:search',
            ':scheme:https',
            'Accept:application/json, text/plain, */*',
            'Accept-Language:zh-CN,zh;q=0.9,en;q=0.8',
//            'Content-Length:703',
            'Content-Type:application/json',
            $this->dpop,
            'Origin:https://jp.mercari.com',
            'Referer:https://jp.mercari.com/',
            'Sec-Ch-Ua:"Google Chrome";v="119", "Chromium";v="119", "Not?A_Brand";v="24"',
            'Sec-Ch-Ua-Mobile:?0',
            'Sec-Ch-Ua-Platform:"macOS"',
            'Sec-Fetch-Dest:empty',
            'Sec-Fetch-Mode:cors',
            'Sec-Fetch-Site:cross-site',
            'User-Agent:Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'X-Platform:web',
        ];

//        if($proxy){
//            $result = request_proxy($url,'POST',$param,$header);
//            return $result;
//        }

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_HEADER, false);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $header);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "POST");
        curl_setopt($ch, CURLOPT_POSTFIELDS, $param);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, FALSE);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, FALSE);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'POST');
        curl_setopt($ch, CURLOPT_AUTOREFERER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, $timeout);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);



        $data = curl_exec($ch);
//        $err = curl_error($ch);
        curl_close($ch);
        return $data;
    }
}