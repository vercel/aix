require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "Aix"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => '18.0' }
  s.source       = { :git => "https://github.com/vercel/aix.git", :tag => "#{s.version}" }

  s.source_files = [
    # Implementation (Swift)
    "ios/**/*.{swift}",
    # Autolinking/Registration (Objective-C++)
    "ios/**/*.{m,mm}",
    # Implementation (C++ objects)
    "cpp/**/*.{hpp,cpp}",
  ]
  
  spm_dependency(s,
    url: "https://github.com/HumanInterfaceDesign/MarkdownView",
    requirement: {kind: "branch", branch: "main"},
    products: ["MarkdownView"]
  )

  spm_dependency(s,
    url: "https://github.com/mattt/AnyLanguageModel",
    requirement: {kind: "branch", branch: "main"},
    products: ["AnyLanguageModel"]
  )

  spm_dependency(s,
    url: "https://github.com/devxoul/UITextView-Placeholder.git",
    requirement: {kind: "branch", branch: "main"},
    products: ["UITextView-Placeholder"]
  )

  # Force -ObjC linker flag in consuming apps to prevent +load method stripping in release builds
  s.user_target_xcconfig = { 'OTHER_LDFLAGS' => '-ObjC' }

  load 'nitrogen/generated/ios/Aix+autolinking.rb'
  add_nitrogen_files(s)

  s.dependency 'React-jsi'
  s.dependency 'React-callinvoker'
  s.dependency 'react-native-keyboard-controller'
  install_modules_dependencies(s)
end
