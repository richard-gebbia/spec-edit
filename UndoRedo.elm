module UndoRedo exposing (..)

import Html exposing (Html)
import UndoList exposing (UndoList)


init : ( model, Cmd msg ) -> ( UndoList ( model, Cmd msg ), Cmd (UndoList.Msg msg) )
init ( model, cmd ) =
    ( UndoList.fresh ( model, cmd ), Cmd.map UndoList.New cmd )


initWithFlags :
    (flags -> ( model, Cmd msg ))
    -> flags
    -> ( UndoList ( model, Cmd msg ), Cmd (UndoList.Msg msg) )
initWithFlags initFn =
    (\flags -> initFn flags |> init)


update :
    (msg -> model -> ( model, Cmd msg ))
    -> UndoList.Msg msg
    -> UndoList ( model, Cmd msg )
    -> ( UndoList ( model, Cmd msg ), Cmd (UndoList.Msg msg) )
update updateFn =
    let
        innerUpdate msg undolist =
            case msg of
                UndoList.Reset ->
                    ( UndoList.reset undolist, Cmd.none )

                UndoList.Redo ->
                    ( UndoList.redo undolist
                    , UndoList.redo undolist
                        |> .present
                        |> Tuple.second
                        |> Cmd.map UndoList.New
                    )

                UndoList.Undo ->
                    ( UndoList.undo undolist, Cmd.none )

                UndoList.Forget ->
                    ( UndoList.forget undolist, Cmd.none )

                UndoList.New innerMsg ->
                    let
                        ( updated, cmd ) =
                            updateFn innerMsg (Tuple.first undolist.present)

                        nextUndoList =
                            UndoList.new ( updated, cmd ) undolist
                    in
                        ( nextUndoList, Cmd.map UndoList.New cmd )
    in
        innerUpdate


view : (model -> Html (UndoList.Msg msg)) -> UndoList ( model, Cmd msg ) -> Html (UndoList.Msg msg)
view viewFn =
    .present >> Tuple.first >> viewFn


subLift : (model -> Sub msg) -> UndoList ( model, Cmd msg ) -> Sub (UndoList.Msg msg)
subLift subFn =
    .present >> Tuple.first >> subFn >> Sub.map UndoList.New


subMapNew : (model -> Sub msg) -> (model -> Sub (UndoList.Msg msg))
subMapNew subFn =
    subFn >> Sub.map UndoList.New


subscriptions : (model -> Sub (UndoList.Msg msg)) -> UndoList ( model, Cmd msg ) -> Sub (UndoList.Msg msg)
subscriptions subFn =
    .present >> Tuple.first >> subFn
