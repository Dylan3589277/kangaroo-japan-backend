<?php
/**
 * Created by PhpStorm.
 * Date: 2021/9/8
 * Time: 15:22
 * description:
 */

namespace app\api\controller;

use app\common\library\Mericari;
use app\common\library\WechatApp;
use app\common\logic\JobQueueLogic;
use app\common\logic\MnpAlertLogic;
use app\common\model\ActivityArea;
use app\common\model\Coupons;
use app\common\model\UrlModel;
use app\common\model\UserModel;
use app\common\service\aliyun\AliyunService;
use think\App;
use think\facade\Config;
use think\facade\Db;
use Tools\StRedis;

class Index extends Base
{
    public function __construct(App $app)
    {
        $this->noNeedLogin = ['*'];
        parent::__construct($app);
    }

    public function index()
    {
        //-- 首页轮播图
        $model = new UrlModel();
        $bannerList = $model
            ->where('cat', 1289)
            ->where('is_deleted', 0)
            ->where('is_show', 1)
            ->field('id,title,picture,url')
            ->order('sort desc,id desc')
            ->select()->toArray();
        foreach ($bannerList as &$item) {
            $item['picture'] = $this->parsepic($item['picture']);
        }
        //-- 获取功能列表
        $funcList = $model
            ->where('cat', 1296)
            ->where('is_deleted', 0)
            ->where('is_show', 1)
            ->field('id,title,picture,url')
            ->order('sort desc,id asc')
            ->select()->toArray();
        foreach ($funcList as &$func) {
            $func['picture'] = $this->parsepic($func['picture']);
        }

        //-- 读取最新的一条通知
        $noticeInfo = Db::name('articles')
            ->where('cat', 1291)
            ->where('is_show', 1)
            ->where('is_deleted', 0)
            ->field('title,id')
            ->order('sort desc,id desc')
            ->find();


        $adInfo = $model
            ->where('cat', 1299)
            ->where('is_deleted', 0)
            ->where('is_show', 1)
            ->field('picture,url as page,sort as login')
            ->order('id desc')
            ->find();
        if($adInfo){
            $adInfo['picture'] = $this->parsepic($adInfo['picture']);
        }

        //-- 商品推荐
        $redis = new StRedis();
//        $catList = $redis->get('index_goods_recomand');
        $goodsList = Db::name('goods')
            ->where('rec',1)
            ->where('shop','mercari')
            ->field('ext_goods_no as goods_no,goods_name,cover,price')
            ->order('id desc')
            ->select()->toArray();
        foreach ($goodsList as &$item){
            $item['price'] = intval($item['price']);
        }
        $catList = [[
            'catId' => 1,
            'catName' => '煤炉推荐',
            'url' => '/pages/daishujun/category/category',
            'goodsList' => $goodsList
        ]];

        $vipAlert = '';
        if($this->userInfo && $this->userInfo['level'] == 1){
            $vipAlert = $redis->get('vipdeadline:alert:'.$this->userInfo['id']);
        }

        $middleTips = [
            'login' => 1,
            'content' => '关注微信公众号，随时接收代拍消息',
            'page'=> '/pages/daishujun/mine/mnp',
            'button' => '关注',
            'icon' => 'http://res.kangaroo-japan.net/picture/36b9db6be43d382f79b77e4a88340462.png'
        ];

        $data =  [
            'banners' => $bannerList,
            'funcs' => $funcList,
            'notices' => $noticeInfo ? $noticeInfo : false,
            'ad' => $adInfo?$adInfo->toArray():false,
            'middleTip' => $middleTips,
            'vipAlert' => [
                'sign' => $vipAlert,
                'msg' => '你的会员已到期，点击前去续费'
            ],
            'catList' => is_array($catList)?$catList:json_decode($catList)
        ];

        return $this->jsuccess('ok',$data);
    }

    public function indexv2()
    {
        //-- 首页轮播图
        $model = new UrlModel();
        $bannerList = $model
            ->where('cat', 1289)
            ->where('is_deleted', 0)
            ->where('is_show', 1)
            ->field('id,title,picture,url')
            ->order('sort desc,id desc')
            ->select()->toArray();
        foreach ($bannerList as &$item) {
            $item['picture'] = $this->parsepic($item['picture']);
        }
        //-- 获取功能列表
        $funcList = $model
            ->where('cat', 1296)
            ->where('is_deleted', 0)
            ->where('is_show', 1)
            ->field('id,title,picture,url')
            ->order('sort desc,id asc')
            ->select()->toArray();
        foreach ($funcList as &$func) {
            $func['picture'] = $this->parsepic($func['picture']);
        }

        //-- 读取最新的一条通知
        $noticeInfo = Db::name('articles')
            ->where('cat', 1291)
            ->where('is_show', 1)
            ->where('is_deleted', 0)
            ->field('title,id')
            ->order('sort desc,id desc')
            ->find();


        //-- 商品推荐
        $redis = new StRedis();
        $areaList = (new ActivityArea())
            ->where('is_deleted',0)
            ->with("goods")
            ->field("id,name,description")
            ->select()->toArray();

        $vipAlert = '';
        if($this->userInfo && $this->userInfo['level'] == 1){
            $vipAlert = $redis->get('vipdeadline:alert:'.$this->userInfo['id']);
        }

        $middleTips = [
            'login' => 1,
            'content' => '关注微信公众号，随时接收商城消息',
            'page'=> '/pages/daishujun/mine/mnp',
            'button' => '关注',
            'icon' => 'https://res.kangaroo-japan.net/picture/36b9db6be43d382f79b77e4a88340462.png'
        ];

        //优惠券
        $coupons = (new Coupons())
            ->where('is_deleted',0)
            ->where('act_type','home')
//            ->where('score','>',0)
            ->where('stock','>',0)
            ->field('id,type,name,data,condition')
            ->limit(3)
            ->select()->toArray();

        $data =  [
            'banners' => $bannerList,
            'funcs' => $funcList,
            'notices' => $noticeInfo ? $noticeInfo : false,
            'middleTip' => $middleTips,
            'vipAlert' => [
                'sign' => $vipAlert,
                'msg' => '你的会员已到期，点击前去续费'
            ],
            'areas' => $areaList,
            'coupons' => $coupons,
        ];

        return $this->jsuccess('ok',$data);
    }


    public function menus()
    {

        $where = [
            ['is_deleted','=',0],
            ['cat','=',1468],
            ['is_show','=',1]
        ];
//        if(isset($_SERVER['HTTP_APPID']) && $_SERVER['HTTP_APPID'] != 'wx84d6de39d3136d49'){
//            $where[] = ['id','not in',[19,20]];
//        }


        //-- 首页轮播图
        $model = new UrlModel();
        //-- 获取功能列表
        $funcList = $model
            ->where($where)
            ->field('id,title,picture,url,description')
            ->order('sort desc,id asc')
            ->select()->toArray();
        foreach ($funcList as &$func) {
            $func['picture'] = $this->parsepic($func['picture']);
            $arr = explode('|',$func['description']);
            $func['appid'] = $arr[0];
            $func['admin'] = intval($arr[1]);
            unset($func['description']);
        }

        //-- 读取最新的一条通知
        $noticeInfo = Db::name('articles')
            ->where('cat', 1291)
            ->where('is_show', 1)
            ->where('is_deleted', 0)
            ->field('title,id')
            ->order('sort desc,id desc')
            ->find();


        $adInfo = $model
            ->where('cat', 1469)
            ->where('is_deleted', 0)
            ->where('is_show', 1)
            ->field('picture,url as page,sort as login')
            ->order('id desc')
            ->find();
        if($adInfo){
            $adInfo['picture'] = $this->parsepic($adInfo['picture']);
        }

        $data =  [
            'menus' => $funcList,
            'notices' => $noticeInfo ? $noticeInfo : false,
            'ad' => $adInfo?$adInfo->toArray():false,
        ];

        return $this->jsuccess('ok',$data);
    }

    public function sites(){

        $where = [
            ['is_deleted','=',0],
            ['is_show','=',1]
        ];
//        if(isset($_SERVER['HTTP_APPID']) && $_SERVER['HTTP_APPID'] != 'wx84d6de39d3136d49'){
//            $where[] = ['code','<>','yahoo'];
//        }

        $list = Db::name('shops')
            ->where($where)
            ->field('code,name,icon,description,url,cat,rec')
            ->order('sort desc')
            ->select();
        $recList = [];
        $siteArr = [];
        foreach ($list as $item){
            $item['icon'] = $this->parsepic($item['icon']);
            if(isset($siteArr[$item['cat']])){
                $siteArr[$item['cat']][] = $item;
            }else{
                $siteArr[$item['cat']] = [$item];
            }
            if($item['rec'] > 0){
                $recList[] = $item;
            }
        }
        $dataList = [];
        $index = 1;
        foreach ($siteArr as $cat => $childs){
            $dataList[] = [
                'id' => $index,
                'name' => $cat,
                'childs' => $childs
            ];
        }
        return $this->jsuccess('ok',['lists' => $dataList,'reclists' => $recList]);
    }


    public function siteindex()
    {
        $bannerCat = 1474;
        $funcCat = 1475;
        $logo = 'https://res.kangaroo-japan.net/picture/cfe5ea5fa8efdbba1c56c7b01d1606c5.png';

        $site = input('site','mercari');
        if($site == 'yahoo'){
            $bannerCat = 1473;
            $funcCat = 1472;
            $logo = 'https://res.kangaroo-japan.net/picture/58b0af971cd7ea48ab49597253fdab1b.png';
        }else if($site == 'amazon'){
            $bannerCat = 1477;
            $funcCat = 1476;
            $logo = 'https://res.kangaroo-japan.net/picture/a2da05fe98549be546665d143cea2aae.png';
        }

        //煤炉、雅虎、亚马逊
        //-- 首页轮播图
        $model = new UrlModel();
        $bannerList = $model
            ->where('cat', $bannerCat)
            ->where('is_deleted', 0)
            ->where('is_show', 1)
            ->field('id,title,picture,url')
            ->order('sort desc,id desc')
            ->select()->toArray();
        foreach ($bannerList as &$item) {
            $item['picture'] = $this->parsepic($item['picture']);
        }
        //-- 获取功能列表
        $funcList = $model
            ->where('cat', $funcCat)
            ->where('is_deleted', 0)
            ->where('is_show', 1)
            ->field('id,title,picture,url')
            ->order('sort desc,id asc')
            ->select()->toArray();
        foreach ($funcList as &$func) {
            $func['picture'] = $this->parsepic($func['picture']);
        }

        $areaList = [];
        if($site == 'mercari'){
            $areaList = (new ActivityArea())
                ->where('is_deleted',0)
                ->with("goods")
                ->field("id,name,description")
                ->select()->toArray();
        }

        $data =  [
            'banners' => $bannerList,
            'funcs' => $funcList,
            'areas' => $areaList,
            'logo' => $logo
        ];

        return $this->jsuccess('ok',$data);
    }



    public function kefu(){
        //企业客服链接 https://work.weixin.qq.com/kfid/kfcdd40f1f6c4b4b499
        return $this->jsuccess('ok',[
//            'image' => 'http://res.kangaroo-japan.net/picture/0e104cf88a4ba196bf3aaa8de9da63fd.png',
            'image' => 'https://res.kangaroo-japan.net/picture/10569c8589d16eef91ffdce166497faa.jpg',
            'time' => '北京时间9点~18点'
        ]);

    }


}