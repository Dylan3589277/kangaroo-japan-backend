<?php

namespace app\common\library;


use app\common\model\Cats;
use think\facade\Db;
use Tools\StRedis;
use voku\helper\HtmlDomParser;

/**
 * https://www.amazon.co.jp/
 */
class Amazon
{

    public function cats()
    {
        exit('done');
        $path = runtime_path() . 'amazon_home.html';
        $content = file_get_contents($path);
        $html = HtmlDomParser::str_get_html($content);
        $model = new Cats();
        for ($i = 10; $i <= 20; $i++) {
            $catDiv = $html->find('a[data-menu-id="' . $i . '"]', 0);
            var_dump('---------' . $catDiv->text() . '------------');
            $childUl = $html->find('ul[data-menu-id="' . $i . '"]', 0);
            $childAs = $childUl->find('a[class="hmenu-item"]');
            $parentData = [
                'name' => trim($catDiv->text()),
                'type' => 'amazon',
                'is_show' => 1,
                'data' => $i,
                'create_time' => time()
            ];
            $pid = $model->insert($parentData, true);
            if (!$pid) {
                continue;
            }
            $dataList = [];
            foreach ($childAs as $a) {
                $href = $a->getAttribute("href");
                $resArr = explode('?', $href);
                parse_str($resArr[1], $result);
                if (!isset($result['node'])) {
                    continue;
                }
                $text = $a->text();
                $text = trim(str_replace([' ', '\n', PHP_EOL], '', $text));
                $dstList = Translate::jp2zh($text);
                $text = $dstList[0]['dst'];
                var_dump($result['node'] . ':' . $text);
                sleep(2);

                $dataList[] = [
                    'name' => $text,
                    'type' => 'amazon',
                    'is_show' => 1,
                    'pid' => $pid,
                    'data' => $result['node'],
                    'create_time' => time()
                ];
            }
            $model->insertAll($dataList);
        }
    }

    public function parseUrl($href)
    {
        if (stripos($href, '/dp/') === false) {
            return false;
        }
        $arr1 = explode('?', $href);
        $arr2 = explode('/', $arr1[0]);
        $index = array_search('dp', $arr2);
        $goodsNo = $arr2[$index + 1];
        return $goodsNo;
    }

    public function getCatHomeGoodsList($cat = '465392', $usecache = true)
    {
        $path = runtime_path() . 'amazon_home_cat.html';
        $key = 'amazon:cat:' . $cat;
        $redis = new StRedis();
        $cache = $redis->get($key);
        if (!empty($cache) && $usecache) {
            return json_decode($cache, true);
        }
//        $url = 'https://amazon.jp-buy.com/gp/browse.html?node=' . $cat;
        $url = 'https://www.amazon.co.jp/gp/browse.html?node='.$cat;
        $content = request_get($url, 30);
        file_put_contents($path, $content);
        if (empty($content)) {
            return [];
        }

        $html = HtmlDomParser::str_get_html($content);
        //-- 用来缓存对应的分类，给检索准备
//        $catSelect = $html->find('select[aria-describedby="searchDropdownDescription"]',0);
//        if($catSelect){
//            $options = $catSelect->find('option');
//            foreach($options as $op){
//                $selected = $op->getAttribute("selected");
//                if($selected == "selected"){
//                    $value = $op->getAttribute("value");
//                    $valArr = explode('=',$value);
//                    var_dump($valArr[1]);
//                    (new Cats())->where('data',$cat)->where('type','amazon')->update(['icon' => $valArr[1]]);
//                }
//            }
//        }
        $items = $html->find('span[class="a-list-item"]');
        $goodsList = [];
        foreach ($items as $span) {
            $a = $span->find('a', 0);
            $href = $a->getAttribute('href');
            $href = urldecode($href);
            $img = $span->find('img', 0);
            if (stripos($href, '/dp/') === false || !$img) {
                continue;
            }
            $src = $img->getAttribute('src');
            if (empty($src)) {
                continue;
            }
            $arr1 = explode('?', $href);
            $arr2 = explode('/', $arr1[0]);
            $index = array_search('dp', $arr2);
            $goodsNo = $arr2[$index + 1];
            if(strlen($goodsNo) <= 5){
                continue;
            }
            $goodsName = $a->getAttribute("title");
            $goodsPrice = $span->find('span[class="a-price-whole"]', 0)->text();
            $goodsPrice = str_replace(',', '', $goodsPrice);

            $desc = $span->find('span[class="a-size-base a-color-base"]', 0)->text();
            $goodsList[] = [
                'goods_name' => $goodsName,
                'cover' => $src,
                'price' => $goodsPrice,
                'goods_no' => $goodsNo,
                'desc' => $desc
            ];
        }
        if (empty($goodsList)) {
            return [];
        }
        $redis->set($key, json_encode($goodsList), 86400);
        return $goodsList;
    }

    public function searchGoodsList($kw = 'apple', $page = 1, $crid = '')
    {
        $path = runtime_path() . 'amazon_search.html';
//        $content = file_get_contents($path);
        $query = [
            'k' => $kw,
            '__mk_ja_JP' => 'カタカナ',
            'ref' => 'nb_sb_noss',
            'page' => $page
        ];
        if (!empty($crid)) {
            $query['crid'] = $crid;
        }
//        $url = 'https://amazon.jp-buy.com/s?' . http_build_query($query);
        $url = 'https://www.amazon.co.jp/s?'.http_build_query($query);
        $content = request_get($url, 30);
        file_put_contents($path, $content);
        if (!$content) {
            return [];
        }
        $html = HtmlDomParser::str_get_html($content);
        $divs = $html->find('div[data-component-type="s-search-result"]');
        $goodsList = [];
        foreach ($divs as $div) {
            $a = $div->find('a', 0);
            $href = $a->getAttribute('href');
            $href = urldecode($href);
            $img = $div->find('img[class="s-image"]', 0);
            if (stripos($href, '/dp/') === false || !$img) {
                continue;
            }
            $src = $img->getAttribute('src');
            if (empty($src)) {
                continue;
            }
            $arr1 = explode('?', $href);
            $arr2 = explode('/', $arr1[0]);
            $index = array_search('dp', $arr2);
            $goodsNo = $arr2[$index + 1];
            if(strlen($goodsNo) <= 5){
                continue;
            }
            $goodsName = $img->getAttribute("alt");
            $goodsPrice = $div->find('span[class="a-price-whole"]', 0)->text();
            $goodsPrice = str_replace(',', '', $goodsPrice);

            $desc = $div->find('span[class="a-size-base a-color-price"]', 0)->text();
            $goodsList[] = [
                'goods_name' => $goodsName,
                'cover' => $src,
                'price' => $goodsPrice,
                'goods_no' => $goodsNo,
                'desc' => $desc
            ];
        }
        return $goodsList;
    }

    public function getDetail($goodsNo)
    {
//        $path = runtime_path().'amazon_cache.html';
        $redis = new StRedis();
        $goodsItemDetail = $redis->hGet('amazon_goods_list', $goodsNo);
        try {

//            $goodsUrl = 'https://amazon.jp-buy.com/dp/' . $goodsNo;
        $goodsUrl ='https://www.amazon.co.jp/dp/'.$goodsNo;
            $content = request_get($goodsUrl);
            if (!$content) {
                return false;
            }
//        file_put_contents($path,$content);

            $html = HtmlDomParser::str_get_html($content);
            //-- 提取json
            $startIndex = mb_stripos($content, '{"dataInJson"');
            if ($startIndex === false) {
                return false;
            }
            $endIndex = mb_stripos($content, "}')", $startIndex);
            $json = mb_substr($content, $startIndex, $endIndex - $startIndex + 1);
            $jsonArr = json_decode($json, true);

            if (!is_null($jsonArr) && !empty($jsonArr['colorImages'])) {
                $landingAsinColor = $jsonArr['landingAsinColor'];
                $colorImages = $jsonArr['colorImages'][$landingAsinColor];
            } else {
                $colorImages = [];
                $scripts = $html->find('script');
                foreach ($scripts as $script) {
                    $scriptHtml = $script->innerhtml;
                    if (stripos($scriptHtml, "'colorImages': {") && stripos($scriptHtml, 'var data = {')) {
                        $index1 = mb_stripos($scriptHtml, " 'colorImages': {");
                        $index1 += mb_strlen("'colorImages': ");
                        $index11 = mb_stripos($scriptHtml, '[', $index1);
                        $index2 = mb_stripos($scriptHtml, "}]},", $index1);
                        $result = mb_substr($scriptHtml, $index11, $index2 - $index11 + 2);
                        $colorImages = json_decode(trim($result));
                    }
                }
            }
            if (empty($colorImages)) {
                return false;
            }
            $imgList = array_column($colorImages, 'hiRes');


            $goodsName = $html->find('span[id=productTitle]', 0)->text();
            $goodsPrice = '';
            $tmmSwatches = $html->find('div[id="tmmSwatches"]', 0);
            if ($tmmSwatches && stripos($tmmSwatches->text(), 'Kindle') !== false) {
                $tmmLis = $tmmSwatches->find('li');
                foreach ($tmmLis as $titem) {
                    $litext = $titem->text();
                    if (stripos($litext, 'Kindle') !== false) {
                        continue;
                    }
                    $tmmSpans = $titem->find('span[class="a-size-base a-color-secondary"]', 0);
                    if (!$tmmSpans) {
                        continue;
                    }
                    $tmmPrice = $tmmSpans->text();
                    if (stripos($tmmPrice, '￥') === false) {
                        continue;
                    }
                    $goodsPrice = str_replace([',', '￥'], '', $tmmPrice);
                }

                if(empty($goodsPrice)){
                    $otherDiv = $tmmSwatches->find('div[id=tmm-grid-swatch-OTHER]',0);
                    if($otherDiv) {
                        $tmmSpans = $otherDiv->find('span[class="a-size-base a-color-secondary"]', 0);
                        if ($tmmSpans) {
                            $tmmPrice = $tmmSpans->text();
                            if (is_string($tmmPrice) && stripos($tmmPrice, '￥') !== false) {
                                $goodsPrice = str_replace([',', '￥'], '', $tmmPrice);
                            }
                        }
                    }
                }

                if(empty($goodsPrice)){
                    return false;
                }
            }

            if(empty($goodsPrice)){
                $div = $html->find('div[id=corePrice_feature_div]',0);
                if($div){
                    $tmmSpans = $div->find('span[class="a-offscreen"]', 0);
                    if ($tmmSpans) {
                        $tmmPrice = $tmmSpans->text();
                        if (is_string($tmmPrice) && stripos($tmmPrice, '￥') !== false) {
                            $goodsPrice = str_replace([',', '￥'], '', $tmmPrice);
                        }
                    }
                }
            }


            if (empty($goodsPrice)) {
                $goodsPrice = $html->find('span[class=a-price-whole]', 0)->text();
                $goodsPrice = str_replace(',', '', $goodsPrice);
            }


            if (empty($goodsPrice)) {
                $goodsPrice = $html->find('span[class="a-size-large a-color-price a-text-bold"]', 0)->text();
                $goodsPrice = str_replace([',', '￥'], '', $goodsPrice);
            }

            if (empty($goodsPrice)) {
                $goodsSpans = $html->find('span[class="a-price a-text-price a-size-medium apexPriceToPay"]');
                foreach ($goodsSpans as $gitem) {
                    $firstSpan = $gitem->find('span[class="a-offscreen"]', 0);
                    $text = $firstSpan->text();
                    if (stripos($text, '￥') !== false) {
                        $goodsPrice = str_replace([',', '￥'], '', $text);
                        break;
                    }
                }
            }


            if (empty($goodsPrice) && isset($goodsItemDetail['price'])) {
                $goodsPrice = $goodsItemDetail['price'];
            }


            $description = $html->find('div[id=feature-bullets]', 0)->innerhtml();
            if (empty($description)) {
                $description = $html->find('div[id="bookDescription_feature_div"]', 0)->innerhtml();
            }
            $twisterContainer = $html->find('div[id=twisterContainer]', 0);

            $divArr = $twisterContainer->find('div[class="a-section a-spacing-small"]');
            $attrList = [];
            foreach ($divArr as $attrDiv) {
                $divId = $attrDiv->getAttribute("id");
                $divLabel = $attrDiv->find('label[class="a-form-label"]', 0)->text();
                if (stripos($divId, 'variation') === false || empty($divLabel)) {
                    continue;
                }
                $selection = $attrDiv->find('span[class="selection"]', 0)->text();
                $attrItemList = [];
                $liArr = $attrDiv->find('li');
                foreach ($liArr as $li) {
                    $attrItemId = $li->getAttribute('data-csa-c-item-id');
                    $attrUrl = $li->getAttribute('data-dp-url');
                    $className = $li->getAttribute('class');
                    $attrName = trim($li->text());
                    $attrSrc = trim($li->text());
                    if (empty($attrName)) {
                        $attrImg = $li->find('img', 0);
                        if ($attrImg) {
                            $attrSrc = $attrImg->getAttribute('src');
                        }
                    }
                    $selected = 0;
                    if (stripos($className, 'swatchUnavailable') !== false) {
                        $selected = -1;
                    } else if (stripos($className, 'swatchSelect') !== false) {
                        $selected = 1;
                    }
                    $attrUrl = str_replace('&amp;', '&', $attrUrl);
                    $attrItemList[] = [
                        'attr_id' => $attrItemId,
                        'url' => !empty($attrUrl) ? $attrUrl : '/dp/' . $attrItemId,
                        'name' => str_replace([' ', PHP_EOL], '', trim($attrName)),
                        'img' => str_replace([' ', PHP_EOL], '', trim($attrSrc)),
                        'nodes' => $li->innerhtml,
                        'selected' => str_replace([' ', PHP_EOL], '', trim($selected))
                    ];
                }
                $attrList[] = [
                    'id' => $divId,
                    'name' => str_replace([' ', PHP_EOL], '', trim($divLabel)),
                    'selection' => $selection,
                    'items' => $attrItemList
                ];
            }

            //-- 属性值
            $extraDiv = $html->find('div[id="detailBulletsWrapper_feature_div"]', 0);
            $extraArr = [
                [
                    'name' => '商品ID',
                    'value' => $goodsNo
                ]
            ];
            if ($extraDiv) {
                $aRows = $extraDiv->find('ul', 0)->find('li');
                if ($aRows) {
                    foreach ($aRows as $aRow) {
                        $listItem = $aRow->find('span[class="a-list-item"]', 0);
                        $spans = $listItem->find('span');
                        if (count($spans) != 3) {
                            continue;
                        }
                        $extraArr[] = [
                            'name' => str_replace([' ', '&rlm;', '&lrm;', ':', PHP_EOL], '', $spans[1]->text()),
                            'value' => str_replace([' ', '&rlm;', '&lrm;', PHP_EOL], '', trim($spans[2]->text()))
                        ];
                    }
                }
            }

            //-- 获取评价
            $acrPopover = $html->find('span[id=acrPopover]', 0);
            $rate = 0;
            if ($acrPopover) {
                $rate = $acrPopover->text();
            }

            $description = str_replace('<hr>', '', $description);

            if (empty($imgList) && isset($goodsItemDetail['cover'])) {
                $goodsPrice = [$goodsItemDetail['cover']];
            }

            return [
                'goods_name' => $goodsName,
                'content' => $description,
                'price' => intval($goodsPrice),
                'cover' => $imgList[0] ?? '',
                'goods_no' => $goodsNo,
                'attrList' => $attrList,
                'extras' => $extraArr,
                'imgurls' => $imgList,
                'seller' => '日本亚马逊',
                'rate' => $rate,
                'seller_address' => '',
            ];


        } catch (\Exception $e) {
            var_dump($e->getMessage() . $e->getFile() . $e->getLine());
            return false;
        }
    }
}