<?php
namespace app\common\library;

/**
 * Created by PhpStorm.
 * User: standopen
 * Date: 2020/11/10
 * Time: 2:45 PM
 */

Class PayParams
{
    private $goodsList = [];
    private $params = [];

    public function __construct()
    {
    }

    /**
     * 配置支付的商品信息
     * @param $goodsId
     * @param $goodsName
     * @param $quantity
     * @param $price
     * @param string $alipayGoodsId
     * @param string $goodsCategory
     * @param string $body
     * @throws \Exception
     */
    public function addGoods($goodsId, $goodsName, $quantity, $price, $alipayGoodsId = '', $goodsCategory = '', $body = '')
    {

        if (empty($goodsId)) {
            throw  new \Exception("goods_id 不能为空");
        }
        if (empty($goodsName)) {
            throw  new \Exception("goods_name 不能为空");
        }
        if (intval($quantity) <= 0) {
            throw  new \Exception("quantity 不能为空");
        }
        if (floatval($price) <= 0) {
            throw  new \Exception("price 不能为空");
        }
        $goodsDetail = [
            'goods_id' => $goodsId,
            'goods_name' => $goodsName,
            'quantity' => $quantity,
            'price' => $price,
        ];

        if (!empty($alipayGoodsId)) {
            $goodsDetail['alipay_goods_id'] = $alipayGoodsId;
        }

        if (!empty($goodsCategory)) {
            $goodsDetail['goods_category'] = $goodsCategory;
        }

        if (!empty($body)) {
            $goodsDetail['body'] = $body;
        }

        $this->goodsList[] = $goodsDetail;
    }

    /**
     * bar_code 支付方式
     * @param $param
     */
    public function setScene($param = 'bar_code')
    {
        $this->params['scene'] = $param;
    }

    /**
     * 用来做授权
     * @param $code
     */
    public function setAuthCode($code)
    {
        $this->params['auth_code'] = $code;
    }

    /**
     * 订单号
     * @param $no
     */
    public function setOutTradeNo($no)
    {
        $this->params['out_trade_no'] = $no;
    }

    /**
     * @param $id
     * 卖家支付宝账号ID，用于支持一个签约账号下支持打款到不同的收款账号，(打款到sellerId对应的支付宝账号)
     */
    public function setSellerId($id)
    {
        $this->params['seller_id'] = $id;
    }

    public function setTotalAmount($amount)
    {
        $this->params['total_amount'] = $amount;
    }

    /**
     * @param $amount
     * (可选,根据需要使用) 订单可打折金额，可以配合商家平台配置折扣活动，如果订单部分商品参与打折，可以将部分商品总价填写至此字段，默认全部商品可打折
     */
    public function setDiscountableAmount($amount)
    {
        $this->params['discountable_amount'] = $amount;
    }

    /**
     * @param $amount
     * 订单不可打折金额，可以配合商家平台配置折扣活动，如果酒水不参与打折，则将对应金额填写至此字段
     * 如果该值未传入,但传入了【订单总金额】,【打折金额】,则该值默认为【订单总金额】-【打折金额】
     */
    public function setUndiscountableAmount($amount)
    {
        $this->params['undiscountable_amount'] = $amount;
    }

    public function setSubject($p)
    {
        $this->params['subject'] = $p;
    }

    public function setBody($b)
    {
        $this->params['body'] = $b;
    }

    public function setOperatorId($p)
    {
        $this->params['operator_id'] = $p;
    }

    public function setStoreId($p)
    {
        $this->params['store_id'] = $p;
    }

    public function setTerminalId($p)
    {
        $this->params['terminal_id'] = $p;
    }

    /**
     * 超时时间
     * @param $time
     */
    public function setTimeoutExpress($time)
    {
        $this->params['timeout_express'] = $time;
    }

    public function setExtendParams($arr)
    {
        $this->params['extend_params'] = $arr;
    }

    public function setAlipayStoreId($storeId)
    {
        $this->params['alipay_store_id'] = $storeId;
    }

    /**
     * 获取交易数据
     * @return string
     * @throws \Exception
     */
    public function getBizContent()
    {

        if (!isset($this->params['total_amount'])) {
            throw new \Exception("total_amount 不能为空");
        }

        if (!isset($this->params['subject'])) {
            throw new \Exception("subject 不能为空");
        }

        if (!isset($this->params['body'])) {
            throw new \Exception("body 不能为空");
        }

        if (!isset($this->goodsList)) {
            throw new \Exception("请配置商品");
        }

        $data = [
            'scene' => isset($this->params['bar_code']) ? $this->params['bar_code'] : 'bar_code',
            'auth_code' => isset($this->params['auth_code']) ? $this->params['auth_code'] : '',
            'out_trade_no' => $this->params['out_trade_no'],
            'seller_id' => isset($this->params['seller_id']) ? $this->params['seller_id'] : '', //
            'total_amount' => $this->params['total_amount'],
            'discountable_amount' => isset($this->params['discountable_amount']) ? $this->params['discountable_amount'] : '',//
            'undiscountable_amount' => isset($this->params['undiscountable_amount']) ? $this->params['undiscountable_amount'] : '',// (可选)
            'subject' => $this->params['subject'],
            'body' => $this->params['body'],
            'timeout_express' => isset($this->params['timeout_express']) ? $this->params['timeout_express'] : '5m',
            'extend_params' => isset($this->params['extend_params']) ? $this->params['extend_params'] : ['sys_service_provider_id' => ''],
            'goods_detail' => $this->goodsList,
        ];

        if (isset($this->params['store_id'])) {
            $data['store_id'] = $this->params['store_id'];
        }

        if (isset($this->params['operator_id'])) {
            $data['operator_id'] = $this->params['operator_id'];
        }

        if (isset($this->params['terminal_id'])) {
            $data['terminal_id'] = $this->params['terminal_id'];
        }

        if (isset($this->params['alipay_store_id'])) {
            $data['alipay_store_id'] = $this->params['alipay_store_id'];
        }

        return json_encode($data, JSON_UNESCAPED_UNICODE);
    }


}