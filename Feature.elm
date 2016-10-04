module Feature exposing (..)

import Html exposing (..)
import Html.App as Html
import Html.Attributes exposing (id, for, value, class, rows)
import Html.Events exposing (onClick, on, targetValue)
import Json.Decode as Decode exposing ((:=))
import Json.Encode as Encode

-- Model

type alias Model =
    { uid: Int
    , name: String
    , description: String
    }


init : Int -> String -> Model
init uid name =
    { uid = uid
    , name = name
    , description = ""
    }


decoder : Decode.Decoder Model
decoder =
    Decode.object3 Model
        ("uid" := Decode.int)
        ("name" := Decode.string)
        ("description" := Decode.string)


encode : Model -> Encode.Value
encode { uid, name, description } =
    Encode.object
        [ ("uid", Encode.int uid)
        , ("name", Encode.string name)
        , ("description", Encode.string description)
        ]


-- Msg

type Msg
    = EditName String
    | EditDesc String
    | DeleteMe


-- Update

type Event
    = Delete

update : Msg -> Model -> (Model, Maybe Event)
update msg model =
    case msg of
        EditName newName ->
            ({ model | name = newName }, Nothing)

        EditDesc newDesc ->
            ({ model | description = newDesc }, Nothing)

        DeleteMe ->
            (model, Just Delete)


-- View

view : Model -> Html Msg
view model =
    div [ class "feature" ]
        [ button 
            [ onClick DeleteMe 
            , class "close-button"
            ] 
            [ text "X" ]
        , div [ class "feature-box" ]
            [ p [] 
                [ label [ for (getId model.uid) ] [ text "Name" ]
                , br [] []
                , input 
                    [ class "feature-name"
                    , id (getId model.uid)
                    , value model.name 
                    , on "input" (Decode.map EditName targetValue)
                    ] []
                ]
            , p []
                [ label [ for "descField" ] [ text "Description" ]
                , br [] []
                , textarea 
                    [ class "feature-desc"
                    , rows 5
                    , id "descField"
                    , value model.description 
                    , on "input" (Decode.map EditDesc targetValue)
                    ] []
                ]
            ]
        ]


-- Extra goodies

getId : Int -> String
getId uid =
    "feature" ++ toString uid
