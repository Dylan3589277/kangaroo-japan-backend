<?php

namespace app\api\controller;

use app\api\controller\Base;
use app\common\model\OrderModel;
use think\App;
use think\facade\Db;
use Tools\StRedis;

class Carts extends Base
{
    public function __construct(App $app)
    {
        parent::__construct($app);
    }

    public function index()
    {
        $list = Db::name('carts')
            ->where('uid', $this->uid)
            ->where('is_deleted', 0)
            ->select()->toArray();
        return $this->jsuccess('ok', $list);
    }

    public function indexv2()
    {

        $rate = \think\facade\Config::get('config.EXCHANGE_RATE');
        $userInfo = Db::name('users')
            ->alias('u')
            ->where('u.id', $this->uid)
            ->field('u.*,l.name as level_name,l.fee as level_fee,l.rate as level_rate')
            ->join('st_user_levels l', 'l.id=u.level', 'LEFT')
            ->find();
        $rate = floatval($rate) + floatval($userInfo['level_rate']);


        $list = Db::name('carts')
            ->where('uid', $this->uid)
            ->where('is_deleted', 0)
            ->select()->toArray();
        foreach ($list as &$cart) {
            $cart['amount'] = intval($cart['amount']);
            $cart['fee'] = intval($cart['fee']);
            $cart['fee_rmb'] = ceil(intval($cart['fee']) * doubleval($rate));
        }

        $valueList = Db::name('value_added')->where('type', 'order')->select()->toArray();
        foreach ($valueList as &$item) {
            $item['checked'] = false;
        }
        $data = [
            'buyTip' => '袋鼠君作为代购平台，无法承担用户因购买二手商品带来的风险（包括但不限于卖家错发漏发，商品状况与描述不一致等情况），也无法提供取消订单，退换货的服务，请您注意，介意勿拍。',
            'list' => $list,
            'values' => $valueList,
            'rate' => round($rate, 4)
        ];
        return $this->jsuccess('ok', $data);
    }

    public function num()
    {
        $num = Db::name('carts')
            ->where('uid', $this->uid)
            ->where('is_deleted', 0)
            ->count();
        return $this->jsuccess('ok', ['num' => $num]);
    }

    public function delcart()
    {
        if (!$this->request->isPost()) {
            $this->jerror('method error');
        }
        $ids = input('ids', '');
        if (empty($ids)) {
            return $this->jerror('错误的请求');
        }
        $res = Db::name('carts')
            ->where('uid', $this->uid)
            ->where('id', 'in', explode(',', $ids))
            ->delete();
        if ($res) {
            return $this->jsuccess('删除成功');
        }
        return $this->jerror('删除失败');
    }

    public function addcart()
    {
        if (!$this->request->isPost()) {
            $this->jerror('method error');
        }
        $id = input('id', '');
        if (empty($id)) {
            return $this->jerror('错误的请求');
        }
        try {

            //-- 判断是否存在
            $result = Db::name('carts')
                ->where('uid', $this->uid)
                ->where('ext_goods_no', $id)
                ->where('is_deleted', 0)
                ->find();
            if ($result) {
                $res = Db::name('carts')
                    ->where('id', $result['id'])
                    ->update(['is_deleted' => 1, 'update_time' => time()]);
                if ($res) {
                    return $this->jsuccess('操作成功');
                }
                return $this->jerror('操作失败');
            }

            $shop = input('shop', 'mercari');
            if (!in_array($shop, ['mercari', 'amazon'])) {
                return $this->jerror('参数错误');
            }
            $key = sprintf('%s_%s', $shop, $id);
            $redis = new StRedis();
            $json = $redis->get($key);
            if (empty($json)) {
                return $this->jerror('操作错误');
            }
            $goodsInfo = is_array($json) ? $json : json_decode($json, true);
            if ($goodsInfo['price'] <= 0) {
                return $this->jerror('商品异常');
            }

            $rate = \think\facade\Config::get('config.EXCHANGE_RATE');
            $userInfo = Db::name('users')
                ->alias('u')
                ->where('u.id', $this->uid)
                ->field('u.*,l.name as level_name,l.fee as level_fee,l.rate as level_rate')
                ->join('st_user_levels l', 'l.id=u.level', 'LEFT')
                ->find();
            $rate = floatval($rate) + floatval($userInfo['level_rate']);
            //-- 获取商城
            $shopInfo = Db::name('shops')
                ->where('is_deleted', 0)
                ->where('code', $shop)
                ->field('code,name,fee')
                ->find();
            $fee = $shopInfo['fee'] + $userInfo['level_fee'];
            $amount = $goodsInfo['price'] + $fee;
            $data = [
                'ext_goods_no' => $id,
                'uid' => $this->uid,
                'goods_name' => $goodsInfo['goods_name'],
                'cover' => oss_url($goodsInfo['cover']),
                'price' => $goodsInfo['price'],
                'seller' => $goodsInfo['seller'],
                'seller_id' => $goodsInfo['seller_id'] ?? 0,
                'seller_address' => $goodsInfo['seller_address'],
                'rate' => $rate,
                'fee' => $fee,
                'shop' => $shop,
                'amount' => $amount,
                'amount_rmb' => ceil($amount * $rate),
                'create_time' => time()
            ];
            $res = Db::name('carts')
                ->insert($data);
            if ($res) {
                return $this->jsuccess('操作成功');
            }
            return $this->jerror('操作失败');

        } catch (\Exception $e) {
            return $this->jerror($e->getMessage());
        }
    }

    public function submit()
    {
        if (!$this->request->isPost()) {
            $this->jerror('method error');
        }
        $cids = input('cids', '');
        if (empty($cids)) {
            return $this->jerror('错误的请求');
        }
        $cidArr = explode(',', $cids);
        if (empty($cidArr) || count($cidArr) > 8) {
            return $this->jerror('最多选择8件商品');
        }

        $values = input('values', '');
        $valueArr = !empty($values) ? json_decode($values, true) : [];
        $valueArr = is_null($valueArr)?[]:$valueArr;


        $list = Db::name('carts')
            ->where('id', 'in', $cidArr)
            ->where('uid', $this->uid)
            ->where('is_deleted', 0)
            ->select()->toArray();
        if (empty($list)) {
            return $this->jerror('请选择要处理的商品');
        }

        $this->requestLimit();

        //-- 查看是否还有未支付的订单，由管理员创建的
        $count = Db::name('orders')
            ->where('uid', $this->uid)
            ->where('status', 0)
            ->where('is_pay', 0)
            ->count();
        if (intval($count) > 0) {
            return $this->jerror('你还有订单未支付');
        }

        $mercariGoodsNo = [];
        foreach ($list as $item) {
            if ($item['shop'] == 'mercari') {
                $mercariGoodsNo[] = $item['ext_goods_no'];
            }
        }
        //-- 判断该商品是否被下单
        if (!empty($mercariGoodsNo)) {
            $orderList = Db::name('orders')
                ->where('shop', 'mercari')
                ->where('ext_goods_no', 'in', $mercariGoodsNo)
                ->whereNotIn('status', [-1, 6, 7])
                ->field('ext_goods_no,goods_name')
                ->select()->toArray();
            if (!empty($orderList)) {
                return $this->jerror(sprintf('%s已被下单了', $orderList[0]['goods_name']));
            }
        }

        $shopList = Db::name('shops')
            ->where('code', 'in', ['mercari', 'amazon'])
            ->select()->toArray();
        $shopArr = array_column($shopList, null, 'code');

        //附加服务
        $valueList = Db::name('value_added')->where('type', 'order')->select()->toArray();
        $valueItemArr = array_column($valueList, null, 'id');

        //-- 获取商城手续费和等级手续费
        $levelInfo = Db::name('user_levels')
            ->where('id', $this->userInfo['level'])
            ->find();
        $idArr = [];
        foreach ($list as $item) {
            $shopInfo = $shopArr[$item['shop']];
            $value_added_fee = 0;
            $value_added = [];
            $value_added_names = [];
            //处理附加服务
            if (isset($valueArr[$item['ext_goods_no']])) {
                $valIds = explode(',', $valueArr[$item['ext_goods_no']]['ids']);
                foreach ($valIds as $valId) {
                    if (!isset($valueItemArr[$valId])) {
                        return $this->jerror('附加服务选择错误');
                    }
                    $value_added_fee += $valueItemArr[$valId]['price'];
                    $value_added[] = $valueItemArr[$valId]['id'];
                    $value_added_names[] = $valueItemArr[$valId]['name'];
                }
            }
            $params = [
                'uid' => $this->uid,
                'goods_name' => $item['goods_name'],
                'cover' => oss_url($item['cover']),
                'price' => $item['price'],
                'shop' => $item['shop'],
                'cat' => 1293,
                'ext_goods_no' => $item['ext_goods_no'],
                'seller' => $item['seller'],
                'seller_id' => $item['seller_id'],
                'seller_address' => $item['seller_address'],
                'quantity' => 1,
                'is_pay' => 0,
                'value_added_fee' => $value_added_fee,
                'value_added' => implode(',', $value_added),
                'value_added_names' => implode(',', $value_added_names)
            ];

            $params['fee'] = $shopInfo['fee'];
            $params['level_fee'] = $levelInfo['fee'];
            $params['amount'] = $params['price'] + $params['fee'] + $params['level_fee'] + $params['value_added_fee'];
            list($errcode, $result) = (new OrderModel())->addRow($params);
            if ($errcode == 0) {
                $idArr[] = $result;
            }
        }

        if (empty($idArr)) {
            return $this->jerror('下单失败');
        }

        //-- 清空购物车
        Db::name('carts')
            ->where('id', 'in', $cidArr)
            ->where('uid', $this->uid)
            ->delete();

        return $this->jsuccess('下单成功', ['ids' => implode(',', $idArr)]);
    }
}