<?php
/**
 * Created by PhpStorm.
 * Date: 2021/9/8
 * Time: 10:40
 * description:
 */

namespace app\api\controller;

use app\common\library\Mericari;
use app\common\library\Translate;
use app\common\library\Yahoo;
use think\App;
use think\facade\Db;
use Tools\StRedis;

class Amazon extends Base
{
    public function __construct(App $app)
    {
        $this->noNeedLogin = ['*'];
        parent::__construct($app);
    }

    /**
     * 商品列表
     */
    public function goods()
    {
        if (!$this->request->isPost()) {
            $this->jerror('method error');
        }

        $amazon = new \app\common\library\Amazon();
        $cat = input('cat', '');
        $kw = input('kw', '');


        $goodsNo = $amazon->parseUrl($kw);
        if(!empty($goodsNo)){
            $data = $amazon->getDetail($goodsNo);
            if($data){
                $arr = ['goodsList' => [$data], 'totalPages' => 1];
                return $this->jsuccess('ok',$arr);
            }
        }

        $sort = input('sort','');
        $page = input('page',1);
        $key = sprintf('amazon_%s_%s_%s',$cat,$page,$kw);

        if(in_array($sort,['SORT_PRICE|ORDER_ASC','SORT_PRICE|ORDER_DESC','SORT_CREATED_TIME|ORDER_DESC'])){
            $key = $key .'_'.$sort;
        }
        $redis = new StRedis();
        $json = $redis->get($key);
        if(!empty($json)){
           // return $this->jsuccess('ok',is_array($json)?$json:json_decode($json,true));
        }
        if(empty($kw)){
            $list = $amazon->getCatHomeGoodsList($cat);
        }else{
            $list = $amazon->searchGoodsList($kw,$page,$cat);
        }
        $dataList = [];
        foreach ($list as $item) {
            $item['url'] = sprintf('https://www.amazon.co.jp/dp/%s', $item['goods_no']);
            if(!$item['price']){
                continue;
            }
            $dataList[] = $item;
            $redis->hSet('amazon_goods_list',$item['goods_no'],json_encode($item));
        }
        $redis->expire('amazon_goods_list',3600);
        $arr = ['goodsList' => $dataList, 'totalPages' => 1];
        $redis->set($key,json_encode($arr),3600);
        return $this->jsuccess('ok',$arr);
    }

    /**
     * 商品详情
     */
    public function detail(){
        if (!$this->request->isPost()) {
            $this->jerror('method error');
        }
        $id = input('id','');
        if(empty($id)){
            return $this->jerror('错误的请求');
        }
        $key = sprintf('amazon_%s',$id);
        $redis = new StRedis();
        $json = $redis->get($key);
//        $json = '';
        if(!empty($json)){
            $data = is_array($json)?$json:json_decode($json,true);
        }else{
            $amazon = new \app\common\library\Amazon();
            $data = $amazon->getDetail($id);
            if($id == 'B0CPPFB4KP'){
            }
            if(!$data || $data['price'] <=0){
                return $this->jerror('商品解析失败');
            }
            $data['url'] = sprintf('https://www.amazon.co.jp/dp/%s', $data['goods_no']);
            $redis->set($key,json_encode($data),3600);
        }

        //-- 计算中文价格
        $data['price_rmb'] = \app\common\model\Goods::ry2rmb($data['price'],$this->uid);

        //-- 判断是否收藏
        $data['collect'] = false;
        if($this->uid){
            $res = Db::name('user_collects')
                ->where('uid',$this->uid)
                ->where('shop','amazon')
                ->where('goods_no',$id)
                ->where('is_deleted',0)
                ->find();
            $data['collect'] = $res?true:false;

            $res = Db::name('carts')
                ->where('uid',$this->uid)
                ->where('ext_goods_no',$id)
                ->where('is_deleted',0)
                ->find();
            $data['cart'] = $res?true:false;
        }
        return $this->jsuccess('ok',$data);
    }


    /**
     * 分类
     * @return \think\response\Json
     */
    public function cats(){
        $catList = Db::name('cats')
            ->where('type','amazon')
            ->where('is_show',1)
            ->where('is_deleted',0)
            ->field('id,pid,name,icon,data')
            ->order('id asc')
            ->select()->toArray();
        $catArr = [];
        $type = input('type','');
        if($type == 'select'){
            foreach ($catList as $item){
                $catArr[$item['pid']][] = ['label' => $item['name'],'id' => $item['id'],'value' => $item['data']];
            }
            $catData = $catArr[0];
            foreach ($catData as &$cat){
                $cat['children'] = isset($catArr[$cat['id']])?$catArr[$cat['id']]:[];
            }
        }else{
            foreach ($catList as $item){
                $catArr[$item['pid']][] = $item;
            }
            $catData = $catArr[0];
            foreach ($catData as &$cat){
                $cat['childs'] = isset($catArr[$cat['id']])?$catArr[$cat['id']]:[];
            }
        }

        return $this->jsuccess('ok',$catData);
    }

}