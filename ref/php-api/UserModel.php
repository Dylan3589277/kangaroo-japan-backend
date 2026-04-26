<?php
/**
 * Created by PhpStorm.
 * Date: 2020/12/6
 * Time: 21:10
 * description:
 */

namespace app\common\model;

use app\common\logic\UserLogic;
use think\db\Query;
use think\Exception;
use think\exception\ValidateException;
use think\facade\Config;
use think\facade\Db;
use think\facade\Request;
use think\helper\Str;
use think\Model;
use think\Validate;
use Tools\Auth\Jwt;

class UserModel extends Model
{
    protected $table = 'st_users';

    protected $autoWriteTimestamp = true;
    /**
     * 验证规则
     * @var array
     */
    public $rules = [
        'mobile|手机号' => 'require',
    ];
    /**
     * 错误提示
     * @var array
     */
    public $errMsg = [
    ];

    public function bindMobile($wechatInfo, $mobile,$inviteUserId=0)
    {
        //-- 判断该手机号是否存在
        $userInfo = $this
            ->where('mobile', $mobile)
            ->find();
        if ($userInfo) {

            //-- 再判断是否绑定过同类型的授权
            $userWechatInfo = Db::name('user_wechat')
                ->where('uid', $userInfo['id'])
                ->where('type', $wechatInfo['type'])
                ->find();
            if ($userWechatInfo && $userWechatInfo['id'] !== $wechatInfo['id']) {
                //return [1,'该手机号已被绑定'];
            }
            //-- 绑定
            Db::startTrans();
            try {
                $res = Db::name('user_wechat')
                    ->where('id', $wechatInfo['id'])
                    ->save(['uid' => $userInfo['id']]);
                if ($res === false) {
                    throw  new \Exception('绑定失败');
                }

                $res = $userInfo
                    ->save([
                        'last_login_time' => time(),
                        'last_login_ip' => Request::ip(),
//                        'nickname' => $wechatInfo['nickname'],
//                        'avatar' => $wechatInfo['avatar']
                    ]);

                if ($res === false) {
                    throw  new \Exception('绑定失败');
                }

                Db::commit();
                //-- 登录成功的情况
                $payload = [
                    'uid' => $userInfo['id'],
                    'user_key' => UserModel::getUserKey($userInfo)
                ];
                return [0, $this->genToken($payload)];

            } catch (\Exception $e) {
                Db::rollback();
                return [1, $e->getMessage()];
            }

        } else {
            //-- 注册用户
            Db::startTrans();
            try {

                $data = [
                    'nickname' => $wechatInfo['nickname'],
                    'avatar' => $wechatInfo['avatar'],
                    'code' => UserModel::_getCode(),
                    'pid' => $inviteUserId,
                    'mobile' => $mobile,
                    'reg_ip' => Request::ip(),
                    'create_time' => time(),
                    'last_login_ip' => Request::ip(),
                    'last_login_time' => time()
                ];

                $uid = $this->insert($data, true);

                if (!$uid) {
                    throw new \Exception('绑定失败');
                }

                $res = Db::name('user_wechat')
                    ->where('id', $wechatInfo['id'])
                    ->save(['uid' => $uid]);
                if (!$res) {
                    throw new \Exception('绑定失败');
                }

                $this->_checkRegistCoupon($uid);

                Db::commit();

                //给邀请人送优惠券
                if($inviteUserId > 0){
                    //-- 更新数量
                    Db::name('users')
                        ->where('id',$inviteUserId)
                        ->inc('child')
                        ->update();
                    //-- 检查送优惠券活动
                    (new UserLogic())->checkInviteCoupon($uid,$inviteUserId);
                }

                //-- 登录成功的情况
                $data['id'] = $uid;
                $payload = [
                    'uid' => $uid,
                    'user_key' => UserModel::getUserKey($data)
                ];
                return [0, $this->genToken($payload)];

            } catch (\Exception $e) {
                Db::rollback();
                return [1, $e->getMessage()];
            }

        }
    }


    /**
     * 微信登录
     * @param $wechatInfo
     * @return array|string
     */
    public function wechatLogin($wechatInfo, $type = 'weapp')
    {
        $wechatInfo = array_change_key_case($wechatInfo, CASE_LOWER);
        if (empty($wechatInfo['unionid']) && empty($wechatInfo['openid'])) {
            return '数据错误';
        }
        if (isset($wechatInfo['unionid']) && !empty($wechatInfo['unionid'])) {
            $map[] = ['unionid', '=', $wechatInfo['unionid']];
        } else {
            $map[] = ['openid', '=', $wechatInfo['openid']];
        }
        $userWechatInfo = Db::name('user_wechat')
            ->where($map)
            ->find();

        if ($userWechatInfo) {
//            Db::name('user_wechat')
//                ->where($map)
//                ->save($wechatData);
            if ($userWechatInfo['uid'] > 0) {
                $userInfo = $this
                    ->where('id', $userWechatInfo['uid'])
                    ->where('status', 1)
                    ->find();
                if ($userInfo) {
                    //-- 登录成功的情况
                    $payload = [
                        'uid' => $userInfo['id'],
                        'user_key' => UserModel::getUserKey($userInfo)
                    ];
                    return ['mobile' => 1, 'token' => $this->genToken($payload)];
                }
                return '用户状态异常';
            }

            $payload = [
                'user_wechat_id' => $userWechatInfo['id'],
                'user_key' => md5($userWechatInfo['openid'])
            ];
            return ['mobile' => 0, 'token' => $this->genToken($payload)];
        } else {
            $wechatData = [
                'nickname' => '用户' . Str::random(6),
                'avatar' => '',
                'openid' => isset($wechatInfo['openid']) ? $wechatInfo['openid'] : '',
                'unionid' => isset($wechatInfo['unionid']) ? $wechatInfo['unionid'] : '',
                'type' => $type
            ];
            $wechatData['create_time'] = time();
            $wechatData['create_ip'] = Request::ip();
            $uwId = Db::name('user_wechat')
                ->insert($wechatData, true);
            if (!$uwId) {
                return '登录失败';
            }
            $payload = [
                'user_wechat_id' => $uwId,
                'user_key' => md5($wechatData['openid'])
            ];
            return ['mobile' => 0, 'token' => $this->genToken($payload)];
        }
    }

    public static function getUserKey($userInfo)
    {
        return md5(md5($userInfo['mobile'] . $userInfo['id']));
    }

    public function genToken($data)
    {
        try {
            $jwt = new Jwt();
            $token = $jwt->encode($data, Config::get('config.JWT_KEY'));
            return $token;
        } catch (\Exception $e) {
            return false;
        }
    }

    /**
     * 新增和编辑
     * @param $params
     * @return array
     */
    public function addRow($params, $admin = 0)
    {
        try {
            \validate($this->rules, $this->errMsg)->failException(true)->check($params);
            $allowField = [
                'mobile',
                'nickname',
                'email',
                'realname',
                'avatar',
                'status',
                'taobaoid',
                'qq',
                'idno',
                'remark',
            ];
            $data = filter_data($params, $allowField);
            //-- 检查密码
            if (!empty($params['password'])) {
                $score = $this->checkPassword($params['password']);
                if ($score < 4) {
                    return [1, '密码强度太弱'];
                }
                $salt = self::_getSalt();
                $data['password'] = self::_makePassword($params['password'], $salt);
                $data['salt'] = $salt;
            }

            $adminInfo = Members::_isLogin();
            $data['last_update_mid'] = $adminInfo['uid'];
            $id = isset($params['id']) ? intval($params['id']) : 0;
            $mobileInfo = $this->where('mobile', $data['mobile'])->find();
            if ($mobileInfo && $mobileInfo['id'] != $id) {
                return [1, '该手机号已存在'];
            }
            if ($id > 0) {
                $info = $this->where('id', intval($id))->find();
                if (!$info) {
                    return [1, '该记录不存在'];
                }
                $res = $info->save($data);
                if (!$res) {
                    return [1, '操作失败请稍后再试'];
                }
            } else {
                $data['create_mid'] = $adminInfo['uid'];
                $data['reg_ip'] = get_client_ip();
                $ipAddress = getIpAddress($data['reg_ip']);
                if ($ipAddress && stripos($ipAddress, '日本') !== false && $admin == 0) {
                    return [1, 'IP 禁止注册'];
                }
                $data['reg_ip_addr'] = $ipAddress ?? '';
                $data['code'] = UserModel::_getCode();
                $data['update_time'] = time();
                $data['create_time'] = time();
                if (empty($data['password'])) {
                    return [1, '请输入密码'];
                }
                $uid = $this
                    ->insert($data, true);

                if (!$uid) {
                    return [1, '操作失败请稍后再试'];
                }
                //-- 送优惠券
                $this->_checkRegistCoupon($uid);
            }

            return [0, '注册成功'];
        } catch (ValidateException $e) {
            return [1, $e->getMessage()];
        } catch (Exception $e) {
            return [1, $e->getMessage()];
        }
    }

    /**
     * 判断密码重点级别
     * @return [type] [description]
     */
    public function checkPassword($password)
    {
        $score = 0;
        if (strlen($password) < 6) {
            return $score;
        }

        if (preg_match("/[0-9]+/", $password)) {
            $score++;
        }
        if (preg_match("/[0-9]{3,}/", $password)) {
            $score++;
        }
        if (preg_match("/[a-z]+/", $password)) {
            $score++;
        }
        if (preg_match("/[a-z]{3,}/", $password)) {
            $score++;
        }
        if (preg_match("/[A-Z]+/", $password)) {
            $score++;
        }
        if (preg_match("/[A-Z]{3,}/", $password)) {
            $score++;
        }
        if (preg_match("/[_|\-|+|=|*|!|@|#|$|%|^|&|(|)]+/", $password)) {
            $score += 2;
        }
        if (preg_match("/[_|\-|+|=|*|!|@|#|$|%|^|&|(|)]{3,}/", $password)) {
            $score++;
        }
        if (strlen($password) >= 10) {
            $score++;
        }
        return $score;
    }

    /**
     * 生密码
     * @param $password
     * @param $salt
     * @return string
     */
    public static function _makePassword($password, $salt)
    {
        return sha1(md5($password) . $salt);
    }

    /**
     * 加密密码所需要的盐
     * @return string
     */
    public static function _getSalt()
    {
        return Str::random(6);
    }

    public static function _getCode()
    {
        $code = Str::random(5, 3);
        $res = Db::name('users')
            ->where('code', $code)
            ->field('id')
            ->find();
        if ($res) {
            return UserModel::_getCode();
        }
        return $code;
    }


    public function doBindWechat($wechatInfo, $mobile, $remark)
    {
        try {
            $adminInfo = Members::_isLogin();
            $data = [
                'nickname' => $wechatInfo['nickname'],
                'avatar' => $wechatInfo['avatar'],
                'last_update_mid' => $adminInfo['uid'],
                'update_time' => time()
            ];
            $this->startTrans();
            //-- 判断手机号是否存在
            $mobileInfo = $this->where('mobile', $mobile)->find();
            if ($mobileInfo) {
                //-- 判断是否已被绑定
                $exInfo = Db::name('user_wechat')
                    ->where('uid', $mobileInfo['id'])
                    ->find();
                if ($exInfo) {
                    //throw new \Exception(sprintf('该手机号已被%s绑定',$exInfo['nickname']));
                }
                //-- 绑定
                $res = $mobileInfo->save($data);
                if (!$res) {
                    throw new \Exception('绑定失败');
                }
                $res = Db::name('user_wechat')
                    ->where('id', $wechatInfo['id'])
                    ->save(['uid' => $mobileInfo['id']]);
                if (!$res) {
                    throw new \Exception('绑定微信失败');
                }
                $this->commit();
                return [0, '绑定成功'];
            }


            $data = [
                'nickname' => $wechatInfo['nickname'],
                'avatar' => $wechatInfo['avatar'],
                'mobile' => $mobile,
                'code' => UserModel::_getCode(),
                'reg_ip' => get_client_ip(),
                'last_update_mid' => $adminInfo['uid'],
                'create_mid' => $adminInfo['uid'],
                'remark' => $remark,
                'update_time' => time(),
                'create_time' => time()
            ];

            $uid = $this
                ->insert($data, true);
            if (!$uid) {
                throw new \Exception('注册新账号失败');
            }
            $res = Db::name('user_wechat')
                ->where('id', $wechatInfo['id'])
                ->save(['uid' => $uid]);
            if (!$res) {
                throw new \Exception('绑定微信失败');
            }
            //-- 送优惠券
            $this->_checkRegistCoupon($uid);

            $this->commit();
            return [0, '绑定成功'];
        } catch (Exception $e) {
            $this->rollback();
            return [1, $e->getMessage()];
        }
    }

    /**
     * 检查优惠券注册
     * @param $uid
     * @throws \think\db\exception\DataNotFoundException
     * @throws \think\db\exception\DbException
     * @throws \think\db\exception\ModelNotFoundException
     */
    private function _checkRegistCoupon($uid)
    {
//        $configArr = (new Configs())->getAllArr();
//        if(!isset($configArr['REGIST_COUPON']) || intval($configArr['REGIST_COUPON']) <=0){
//            return true;
//        }
//        $couponInfo = (new Coupons())->where('id',$configArr['REGIST_COUPON'])->find();

        $couponList = (new Coupons())
            ->where('is_deleted', 0)
            ->where('act_type', 'regist')
            ->where('stock', '>', 0)
            ->order('id desc')
            ->select()->toArray();
        if (empty($couponList)) {
            return;
        }
        foreach ($couponList as $couponInfo){
            (new UserCoupons())->addRow($couponInfo, ['id' => $uid]);
        }
    }

    /**
     * 增减积分
     * @param $uid
     * @param $score
     * @param int $type
     * @param string $remark
     * @return false|int|string
     * @throws \think\db\exception\DataNotFoundException
     * @throws \think\db\exception\DbException
     * @throws \think\db\exception\ModelNotFoundException
     */
    public static function addScore($uid, $score, $type = 1, $remark = '消费送积分')
    {
        $model = new UserModel();
        $userInfo = $model->where('id', $uid)->find();
        if (!$userInfo) {
            return false;
        }
        $data = [
            'score' => $userInfo['score'] + $score
        ];
        if ($score > 0) {
            $data['score_total'] = $userInfo['score_total'] + $score;
        }
        $res = $model->where('id', $uid)->update($data);
        if (!$res) {
            return false;
        }
        $data = [
            'uid' => $uid,
            'type' => $type,
            'remark' => $remark,
            'score' => $score,
            'before_score' => $userInfo['score'],
            'after_score' => $userInfo['score'] + $score,
            'create_time' => time()
        ];
        return Db::name('score_log')->insert($data);
    }

    /**
     * 付款获得积分
     * @param $amount
     * @param $uid
     * @return false|int|string
     * @throws \think\db\exception\DataNotFoundException
     * @throws \think\db\exception\DbException
     * @throws \think\db\exception\ModelNotFoundException
     */
    public static function payAddScore($amount, $uid)
    {
        if ($amount <= 0) {
            return false;
        }
        $scoreAmount = Db::name('config')->where('name', 'YEN_SCORE_RATE')->value('value');
        $score = intval($amount / floatval($scoreAmount));
        return self::addScore($uid, $score);
    }
}