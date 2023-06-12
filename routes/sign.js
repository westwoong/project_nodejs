const { User } = require('../models');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
require('dotenv').config('../.env');
const express = require('express');
const signRoute = express.Router();
const ErrorCatch = require('../middleware/trycatch');
const RefreshAuthorization = require('../middleware/RefreshToken');

signRoute.post('/sign-up', ErrorCatch(async (req, res) => {
    const { name, nickname, password, phoneNumber } = req.body;
    // 이름 검증
    const SpaceCheckName = /\s/; // 공백 확인용 정규식
    if (SpaceCheckName.test(name)) {
        return res.status(400).send("이름 안에 공백이 포함되어있습니다, 공백없이 입력바랍니다.");
    }
    const KoreanCheckName = /^[\uac00-\ud7af]*$/; // 한글 검수용 정규식
    if (!KoreanCheckName.test(name)) {
        return res.status(400).send("한글로 된 이름을 입력 바랍니다.")
    }
    if (!name || name.length < 2) {
        return res.status(400).send("1글자 이상으로 된 정확한 이름을 입력해주시기 바랍니다.");
    }

    // 닉네임 검증
    const CheckDuplicateNickName = await User.findOne({ attributes: ['nickname'], where: { nickname } });
    if (CheckDuplicateNickName) {
        return res.status(409).send("이미 존재하는 닉네임 입니다.");
    }
    if (!nickname || nickname.length < 3 || nickname.length > 11) {
        return res.status(400).send("닉네임을 3글자 이상 10글자 이상으로 기재해주시기 바랍니다.");
    }
    const CheckValidNickName = /^[a-zA-Z0-9_]+$/; // 영어,숫자,언더스코어만 입력가능하게하는 정규식
    if (!CheckValidNickName.test(nickname)) {
        return res.status(400).send(`잘못된 닉네임입니다, 닉네임은 영어, 숫자, "_"로만 구성이 가능합니다.`);
    }

    // 휴대폰 검증
    const CheckDuplicatePhoneNumber = await User.findOne({ attributes: ['phone_number'], where: { phoneNumber } });
    if (CheckDuplicatePhoneNumber) {
        return res.status(409).send("이미 존재하는 휴대폰 번호의 계정이 있습니다.");
    }
    //첫 시작이010으로 시작하는지 확인, \d 숫자인지 확인 후 8자리로 입력되었는지 확인
    const CheckValidatorPhoneNumber = /^010\d{8}$/;
    if (!phoneNumber || !CheckValidatorPhoneNumber.test(phoneNumber)) {
        return res.status(400).send("잘못된 휴대폰 번호를 입력하셨습니다, 010으로 시작하는 정확한 휴대폰번호 11자리를 입력해주시기 바랍니다");
    }

    // 비밀번호 검증
    if (!password || password.length < 9) {
        return res.status(400).send('비밀번호는 최소 9자리 이상 입력');
    }

    let PasswordVaild = 0;
    const CheckLowerCase = /[a-z]/g;
    if (CheckLowerCase.test(password)) {
        PasswordVaild++;
    }

    const CheckUpperCase = /[A-Z]/g;
    if (CheckUpperCase.test(password)) {
        PasswordVaild++;
    }

    const CheckNummberCase = /[0-9]/g;
    if (CheckNummberCase.test(password)) {
        PasswordVaild++;
    }

    //특수기호 확인
    const CheckSpesialCase = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/g;
    if (CheckSpesialCase.test(password)) {
        PasswordVaild++;
    }

    if (PasswordVaild < 3) {
        return res.status(400).send('비밀번호는 영대문자, 영소문자, 숫자, 특수문자 중 3가지 이상이 포함되어있어야합니다')
    }

    const CheckPhoneNumberInPassword =
        password.includes(phoneNumber.slice(3, 7)) ||
        password.includes(phoneNumber.slice(-4));

    if (CheckPhoneNumberInPassword) {
        return res.status(400).send('비밀번호에 연속된 휴대폰번호가 포함되어있으면 안됩니다!');
    }

    // 비밀번호 암호화
    crypto.randomBytes(64, (err, buffer) => {
        const salt = buffer.toString('base64'); // 랜덤값 문자열변환 및 변수 할당
        crypto.pbkdf2(password, salt, 105820, 64, 'SHA512', async (err, buffer) => {
            const hashedPassword = buffer.toString('base64'); // 암호화 비밀번호 생성

            await User.create({ phoneNumber, name, nickname, salt, password: hashedPassword });
            res.status(201).send(`회원가입이 완료되었습니다\n${nickname} 님의 아이디는 ${phoneNumber} 입니다.`);
        });
    });
}));

signRoute.post('/sign-in', ErrorCatch(async (req, res) => {
    const { phoneNumber, password } = req.body;
    console.log(phoneNumber, password);

    const UserCheckExist = await User.findOne({ attributes: ['phone_number'], where: { phoneNumber } });
    if (!UserCheckExist) {
        return res.status(400).send('존재하지 않는 계정입니다.');
    }

    // 사용자 정보 sequelize 형식으로 조회
    const CheckUserSalt = await User.findAll({ attributes: ['salt'], where: { phoneNumber } });
    const CheckUserPassword = await User.findAll({ attributes: ['password'], where: { phoneNumber } });

    // sequelize형식으로 조회된 정보 값으로만 분리 진행
    const salt = CheckUserSalt.map(row => row.salt).join();
    const storedHashedPassword = CheckUserPassword.map(row => row.password).join();

    // 비밀번호가 일치한지 확인
    crypto.pbkdf2(password, salt, 105820, 64, 'SHA512', async (err, buffer) => {
        // password, salt 값을 인자로 받아서 입력받은 비밀번호를 다시 암호화 생성
        const hashedPassword = buffer.toString('base64');

        // 입력받은 계정의 PK 값 확인
        const UserPkValue = await User.findAll({ attributes: ['id'], where: { phoneNumber } });

        // 찾은 PK 값 payload.id 에 할당하기.
        const payload = { id: UserPkValue }
        const accessToken = jwt.sign(payload, process.env.JSON_SECRETKEY, { expiresIn: "7d" });
        const refreshToken = jwt.sign(payload, process.env.REFRESH_SECRETKEY, { expiresIn: "60d" });

        //PK 값만 추출
        const realPrimayKey = payload.id[0].dataValues.id;

        // 입력한 비밀번호화 DB에 있는 정보가 동일한지 확인
        if (hashedPassword === storedHashedPassword) {
            //refresh_token 값 DB 저장
            await User.update({ refreshToken }, { where: { id: realPrimayKey } });
            return res.status(200).send({ accessToken, refreshToken });
        } else {
            return res.status(400).send("비밀번호가 틀렸습니다.");
        }
    });
}));

signRoute.post('/refresh-token', RefreshAuthorization, ErrorCatch(async (req, res) => {

    const userId = req.user[0].id;
    const token = req.token;
    const validationToken = await User.findOne({ where: { id: userId }, attributes: ['refresh_Token'] });
    if (token !== validationToken.dataValues.refresh_Token) {
        return res.status(401).send('401');
    }
    const payload = { id: userId };
    const accessToken = jwt.sign(payload, process.env.JSON_SECRETKEY, { expiresIn: "7d" });

    return res.status(200).send({ accessToken });
}));

module.exports = signRoute;