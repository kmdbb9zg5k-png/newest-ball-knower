Pod::Spec.new do |s|
  s.name = 'BallKnowerNativeAuthSession'
  s.version = '1.0.0'
  s.summary = 'Ball Knower iOS authentication session bridge'
  s.license = 'UNLICENSED'
  s.homepage = 'https://ballknowerofficial.com'
  s.author = 'Ball Knower'
  s.source = { :git => 'https://github.com/kmdbb9zg5k-png/newest-ball-knower.git' }
  s.source_files = 'ios/Sources/**/*.swift'
  s.ios.deployment_target = '15.0'
  s.dependency 'Capacitor'
  s.swift_version = '5.9'
end
